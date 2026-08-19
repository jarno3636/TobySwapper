"use client";

import { useEffect, useMemo, useState } from "react";
import { erc20Abi, formatUnits, parseUnits, type Address } from "viem";
import { base } from "wagmi/chains";
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
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

export default function LandVault({ tokenId, owner }: { tokenId: bigint; owner?: Address }) {
  const { address } = useAccount();
  const client = usePublicClient({ chainId: base.id });
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
    client.getBytecode({ address: vault }).then((code) => { if (!cancelled) setDeployed(Boolean(code && code !== "0x")); }).catch(() => { if (!cancelled) setDeployed(false); });
    return () => { cancelled = true; };
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

  async function wakeVault() {
    if (!client) return;
    try {
      setBusy("wake"); setMessage("");
      const hash = await writeContractAsync({ address: LORE_COLLECTION_ADDRESS, abi: LORE_DEEDS_ABI, functionName: "createAccount", args: [tokenId], chainId: base.id });
      await client.waitForTransactionReceipt({ hash });
      setDeployed(true); setMessage("Land Vault is awake.");
    } catch { setMessage("The Land Vault could not be created."); }
    finally { setBusy(""); }
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
      <div className="land-vault-head"><div><span className="land-section-kicker">LAND VAULT</span><h2>What this land carries</h2><p>Give this land a pouch of its own — a place for SEED, relics, and pond assets to live with the deed.</p></div><span className={`land-vault-state ${deployed ? "awake" : "sleeping"}`}>{deployed ? "AWAKE" : "SLEEPING"}</span></div>
      <div className="land-vault-address"><span>VAULT</span><code>{vault ? `${vault.slice(0, 8)}…${vault.slice(-6)}` : "Resolving…"}</code>{vault && <button onClick={() => navigator.clipboard.writeText(vault)}>Copy</button>}</div>
      <div className="land-vault-assets">{balances.map((asset) => <div key={asset.id}><small>{asset.id}</small><strong>{asset.decimals ? Number(formatUnits(asset.value, asset.decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 }) : asset.value.toLocaleString()}</strong></div>)}</div>
      {!deployed && isKeeper && <button className="land-vault-wake" onClick={wakeVault} disabled={Boolean(busy)}>{busy === "wake" ? "Waking vault…" : "Wake Land Vault"}</button>}
      {deployed && isKeeper && <div className="land-vault-send"><label><span>SEND TO LAND</span><select value={selected} onChange={(e) => setSelected(e.target.value as VaultAsset)}>{assets.map((asset) => <option key={asset.id}>{asset.id}</option>)}</select></label><label><span>AMOUNT</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} /></label><button onClick={sendToLand} disabled={Boolean(busy)}>{busy === "send" ? "Moving…" : `Send to #${tokenId}`}</button></div>}
      <p className="land-vault-foot">What lives here travels with the land account. Only move assets here when you mean to make them part of this place.</p>
      {message && <div className="land-vault-message">{message}</div>}
    </section>
  );
}
