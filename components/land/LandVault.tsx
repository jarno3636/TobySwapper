"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { erc20Abi, formatUnits, parseUnits, type Address } from "viem";
import { base } from "wagmi/chains";
import { useAccount, usePublicClient, useReadContract, useReadContracts, useSwitchChain, useWriteContract } from "wagmi";
import { TOBY, PATIENCE, TABOSHI } from "@/lib/addresses";
import { LORE_COLLECTION_ADDRESS, LORE_DEEDS_ABI } from "@/lib/lore-deeds";
import { TABOSHI1_ADDRESS, TABOSHI1_ABI, TABOSHI1_TOKEN_ID } from "@/lib/taboshi1";
import { TABOSHI_SEEDS_ADDRESS, TABOSHI_SEEDS_ABI, TABOSHI_SEED_ID } from "@/lib/taboshi-seeds";

type VaultAsset = "TOBY" | "PATIENCE" | "TABOSHI" | "OLD LEAF" | "SEED";

const assets: Array<{ id: VaultAsset; kind: "erc20" | "erc1155"; address: Address; decimals: number; tokenId?: bigint }> = [
  { id: "TOBY", kind: "erc20", address: TOBY, decimals: 18 },
  { id: "PATIENCE", kind: "erc20", address: PATIENCE, decimals: 18 },
  { id: "TABOSHI", kind: "erc20", address: TABOSHI, decimals: 18 },
  { id: "OLD LEAF", kind: "erc1155", address: TABOSHI1_ADDRESS, decimals: 0, tokenId: TABOSHI1_TOKEN_ID },
  { id: "SEED", kind: "erc1155", address: TABOSHI_SEEDS_ADDRESS, decimals: 0, tokenId: TABOSHI_SEED_ID },
];


function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

export default function LandVault({ tokenId, owner }: { tokenId: bigint; owner?: Address }) {
  const { address, chainId } = useAccount();
  const client = usePublicClient({ chainId: base.id });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [selected, setSelected] = useState<VaultAsset>("SEED");
  const [amount, setAmount] = useState("1");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [deployed, setDeployed] = useState<boolean | null>(null);

  const accountRead = useReadContract({
    address: LORE_COLLECTION_ADDRESS, abi: LORE_DEEDS_ABI, functionName: "accountOf",
    args: [tokenId], chainId: base.id,
    query: { staleTime: 60_000, refetchInterval: false, refetchOnWindowFocus: false },
  });
  const vault = typeof accountRead.data === "string" ? accountRead.data as Address : undefined;

  useEffect(() => {
    if (!vault || !client) return;
    let cancelled = false;

    void client
      .getBytecode({ address: vault })
      .then((code) => {
        if (!cancelled) setDeployed(Boolean(code && code !== "0x"));
      })
      .catch(() => {
        if (!cancelled) setDeployed(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, vault]);

  const vaultReads = useReadContracts({
    contracts: vault ? [
      { address: TOBY, abi: erc20Abi, functionName: "balanceOf", args: [vault], chainId: base.id },
      { address: PATIENCE, abi: erc20Abi, functionName: "balanceOf", args: [vault], chainId: base.id },
      { address: TABOSHI, abi: erc20Abi, functionName: "balanceOf", args: [vault], chainId: base.id },
      { address: TABOSHI1_ADDRESS, abi: TABOSHI1_ABI, functionName: "balanceOf", args: [vault, TABOSHI1_TOKEN_ID], chainId: base.id },
      { address: TABOSHI_SEEDS_ADDRESS, abi: TABOSHI_SEEDS_ABI, functionName: "balanceOf", args: [vault, TABOSHI_SEED_ID], chainId: base.id },
    ] as const : [],
    query: { enabled: Boolean(vault), staleTime: 30_000, refetchInterval: false, refetchOnWindowFocus: false, refetchOnMount: "always" },
  });

  const balances = useMemo(() => assets.map((asset, index) => {
    const value = typeof vaultReads.data?.[index]?.result === "bigint" ? vaultReads.data[index].result : 0n;
    return { ...asset, value };
  }), [vaultReads.data]);

  const isKeeper = Boolean(address && owner && address.toLowerCase() === owner.toLowerCase());

  const checkVaultDeployment = useCallback(async () => {
    if (!vault || !client) return false;
    try {
      const code = await withTimeout(
        client.getBytecode({ address: vault }),
        12_000,
        "Vault status check timed out.",
      );
      const ready = Boolean(code && code !== "0x");
      setDeployed(ready);
      return ready;
    } catch {
      return false;
    }
  }, [client, vault]);


  async function createVault() {
    if (!client || !address || !vault || busy) return;

    try {
      setBusy("create");
      setMessage("Checking your Land Vault…");

      // A previous attempt may actually have completed even if the embedded
      // wallet UI never returned control to the page.
      if (await checkVaultDeployment()) {
        setMessage("Land Vault is already ready.");
        return;
      }

      if (chainId !== base.id) {
        setMessage("Switching to Base…");
        await withTimeout(
          switchChainAsync({ chainId: base.id }),
          20_000,
          "Network switch timed out.",
        );
      }

      // Preflight is useful for catching a real contract revert, but do not
      // pass the simulated request object into the embedded wallet. Some Base
      // smart-wallet providers can stall when an explicit simulated `account`
      // is forwarded through wagmi.
      setMessage("Checking the canonical ERC-6551 registry…");
      await withTimeout(
        client.simulateContract({
          address: LORE_COLLECTION_ADDRESS,
          abi: LORE_DEEDS_ABI,
          functionName: "createAccount",
          args: [tokenId],
          account: address,
        }),
        15_000,
        "Vault preflight timed out.",
      );

      setMessage("Confirm Create Land Vault in your wallet.");

      // Submit a clean connector-native request. Most important change:
      // this cannot hold the UI in "Creating…" forever.
      const hash = await withTimeout(
        writeContractAsync({
          address: LORE_COLLECTION_ADDRESS,
          abi: LORE_DEEDS_ABI,
          functionName: "createAccount",
          args: [tokenId],
          chainId: base.id,
        }),
        40_000,
        "The wallet request did not return.",
      );

      setMessage("Creating Land Vault on Base…");

      const receipt = await withTimeout(
        client.waitForTransactionReceipt({
          hash,
          confirmations: 1,
          timeout: 45_000,
        }),
        55_000,
        "The transaction is taking longer than expected.",
      );

      if (receipt.status !== "success") {
        throw new Error("The vault transaction reverted.");
      }

      // Give the RPC a moment to expose CREATE2 bytecode after the receipt.
      await new Promise((resolve) => setTimeout(resolve, 900));
      const ready = await checkVaultDeployment();

      if (ready) {
        setMessage("Land Vault ready ✓");
        await vaultReads.refetch();
      } else {
        setMessage(
          "The transaction confirmed. The vault is still syncing on Base — tap Check Vault in a moment.",
        );
      }
    } catch (error: any) {
      // Always re-check first. Embedded wallet promises sometimes time out even
      // though the user successfully confirmed the transaction.
      const ready = await checkVaultDeployment();
      if (ready) {
        setMessage("Land Vault ready ✓");
        return;
      }

      const text = String(
        error?.shortMessage ||
        error?.details ||
        error?.cause?.shortMessage ||
        error?.message ||
        "",
      );

      if (/wallet request did not return|timed out|taking longer/i.test(text)) {
        setMessage(
          "The wallet did not return control to TobySwap. Nothing is stuck here — tap Check Vault first, then Try Again if it is still not deployed.",
        );
      } else if (/reject|denied|cancel|user rejected/i.test(text)) {
        setMessage("Vault creation was cancelled in your wallet.");
      } else if (/already|deployed|create2/i.test(text)) {
        setMessage("This Land Vault may already exist. Tap Check Vault.");
      } else if (/nonexistent|not minted|invalid token/i.test(text)) {
        setMessage("The canonical contract does not recognize this Lore Deed as minted.");
      } else {
        setMessage(
          "The canonical ERC-6551 creation call did not complete. No assets moved. Tap Check Vault before trying again.",
        );
      }
    } finally {
      // Critical: never leave the button permanently disabled if an embedded
      // wallet provider fails to settle its promise.
      setBusy("");
    }
  }

  async function manuallyCheckVault() {
    if (busy) return;
    setBusy("check");
    setMessage("Checking the vault on Base…");
    const ready = await checkVaultDeployment();
    setMessage(
      ready
        ? "Land Vault ready ✓"
        : "The vault is not deployed yet. You can safely try Create Land Vault again.",
    );
    setBusy("");
  }

  async function sendToLand() {
    if (!vault || !address || !client || !isKeeper) return;
    const asset = assets.find((item) => item.id === selected)!;
    try {
      setBusy("send"); setMessage("");
      let hash: `0x${string}`;
      if (asset.kind === "erc20") {
        const value = parseUnits(amount || "0", asset.decimals);
        if (value <= 0n) throw new Error("bad amount");
        hash = await writeContractAsync({ address: asset.address, abi: erc20Abi, functionName: "transfer", args: [vault, value], chainId: base.id });
      } else {
        const value = BigInt(amount || "0");
        if (value <= 0n) throw new Error("bad amount");
        const abi = selected === "SEED" ? TABOSHI_SEEDS_ABI : TABOSHI1_ABI;
        hash = await writeContractAsync({ address: asset.address, abi, functionName: "safeTransferFrom", args: [address, vault, asset.tokenId!, value, "0x"], chainId: base.id } as any);
      }
      await client.waitForTransactionReceipt({ hash });
      await vaultReads.refetch();
      setMessage(`${amount} ${selected} moved into Land #${tokenId}.`);
    } catch { setMessage("That asset could not be moved into the Land Vault."); }
    finally { setBusy(""); }
  }

  return (
    <section className="land-vault-card">
      <div className="land-vault-head">
        <div>
          <span className="land-section-kicker">LAND VAULT</span>
          <h2>Your deed&apos;s onchain wallet</h2>
          <p>
            Every canonical Lore Deed has a deterministic ERC-6551 account. Once deployed,
            the current deed owner can use that account to manage assets held with the land.
          </p>
        </div>
        <span className={`land-vault-state ${deployed ? "awake" : "sleeping"}`}>
          {deployed ? "READY" : deployed === false ? "NOT DEPLOYED" : "CHECKING"}
        </span>
      </div>

      <div className="land-vault-address">
        <span>VAULT ADDRESS</span>
        <code>{vault ? `${vault.slice(0, 8)}…${vault.slice(-6)}` : "Resolving…"}</code>
        {vault ? <button onClick={() => navigator.clipboard.writeText(vault)}>Copy</button> : null}
      </div>

      {deployed ? (
        <>
          <div className="land-vault-assets">
            {balances.map((asset) => (
              <div key={asset.id}>
                <small>{asset.id}</small>
                <strong>
                  {asset.decimals
                    ? Number(formatUnits(asset.value, asset.decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })
                    : asset.value.toLocaleString()}
                </strong>
              </div>
            ))}
          </div>

          {isKeeper ? (
            <div className="land-vault-send">
              <label>
                <span>SEND TO LAND</span>
                <select value={selected} onChange={(e) => setSelected(e.target.value as VaultAsset)}>
                  {assets.map((asset) => <option key={asset.id}>{asset.id}</option>)}
                </select>
              </label>
              <label>
                <span>AMOUNT</span>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                />
              </label>
              <button onClick={sendToLand} disabled={Boolean(busy)}>
                {busy === "send" ? "Moving…" : `Send to #${tokenId}`}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="land-vault-create-panel">
          <div>
            <strong>Create the Land Vault</strong>
            <p>
              This deploys the deed&apos;s already-determined token-bound account. It does not
              change the deed, mint anything, or move any assets.
            </p>
          </div>
          {isKeeper ? (
            <div className="land-vault-create-actions">
              <button
                className="land-vault-wake"
                onClick={createVault}
                disabled={Boolean(busy) || !vault}
              >
                {busy === "create" ? "Waiting for wallet…" : "Create Land Vault"}
              </button>
              <button
                type="button"
                className="land-vault-check"
                onClick={manuallyCheckVault}
                disabled={Boolean(busy) || !vault}
              >
                {busy === "check" ? "Checking…" : "Check Vault"}
              </button>
            </div>
          ) : (
            <span className="land-vault-owner-note">Only the connected deed owner gets the creation shortcut here.</span>
          )}
        </div>
      )}

      <p className="land-vault-foot">
        The vault address is deterministic even before deployment. For safety, TobySwap only enables
        asset management here after the account contract is confirmed on Base.
      </p>
      {message ? <div className="land-vault-message">{message}</div> : null}
    </section>
  );
}
