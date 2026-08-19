"use client";

import { useMemo, useState } from "react";
import { formatUnits, parseUnits, type Address } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { makeBaseClient } from "@/lib/rpc";
import { CANONICAL_LORE_LAND, CANONICAL_LORE_ABI } from "@/lib/lore-deeds";
import { TOBY, PATIENCE, TABOSHI } from "@/lib/addresses";
import { TABOSHI1_ADDRESS, TABOSHI1_TOKEN_ID } from "@/lib/taboshi1";
import { TABOSHI_SEEDS_ADDRESS, TABOSHI_SEED_ID } from "@/lib/taboshi-seeds";

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const ERC1155_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "safeTransferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "id", type: "uint256" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

type AssetId = "TOBY" | "PATIENCE" | "TABOSHI" | "OLD_LEAF" | "SEED";

const assets: Array<{
  id: AssetId;
  label: string;
  address: Address;
  decimals: number;
  standard: "erc20" | "erc1155";
  tokenId?: bigint;
}> = [
  { id: "TOBY", label: "TOBY", address: TOBY, decimals: 18, standard: "erc20" },
  { id: "PATIENCE", label: "PATIENCE", address: PATIENCE, decimals: 18, standard: "erc20" },
  { id: "TABOSHI", label: "TABOSHI", address: TABOSHI, decimals: 18, standard: "erc20" },
  { id: "OLD_LEAF", label: "OLD LEAF", address: TABOSHI1_ADDRESS, decimals: 0, standard: "erc1155", tokenId: TABOSHI1_TOKEN_ID },
  { id: "SEED", label: "SEED", address: TABOSHI_SEEDS_ADDRESS, decimals: 0, standard: "erc1155", tokenId: TABOSHI_SEED_ID },
];

export function PouchLandTransfer({
  deedIds,
}: {
  deedIds: string[];
}) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [deedId, setDeedId] = useState(deedIds[0] || "");
  const [assetId, setAssetId] = useState<AssetId>("SEED");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selected = useMemo(
    () => assets.find((asset) => asset.id === assetId) || assets[0],
    [assetId],
  );

  const { data: vault } = useReadContract({
    address: CANONICAL_LORE_LAND,
    abi: CANONICAL_LORE_ABI,
    functionName: "accountOf",
    args: deedId ? [BigInt(deedId)] : undefined,
    query: { enabled: Boolean(deedId), staleTime: 60_000, refetchOnMount: true },
  });

  const { data: balance } = useReadContract({
    address: selected.address,
    abi: selected.standard === "erc20" ? ERC20_ABI : ERC1155_ABI,
    functionName: "balanceOf",
    args:
      !address
        ? undefined
        : selected.standard === "erc20"
          ? [address]
          : [address, selected.tokenId || 1n],
    query: { enabled: Boolean(address), staleTime: 15_000, refetchOnMount: "always" },
  } as any);

  const formattedBalance = useMemo(() => {
    try {
      if (typeof balance !== "bigint") return "0";
      return selected.decimals === 0
        ? balance.toString()
        : Number(formatUnits(balance, selected.decimals)).toLocaleString(undefined, {
            maximumFractionDigits: 4,
          });
    } catch {
      return "0";
    }
  }, [balance, selected]);

  async function send() {
    if (!address || !vault || !deedId || !amount) return;

    setBusy(true);
    setMessage("Opening your wallet…");

    try {
      const value =
        selected.decimals === 0
          ? BigInt(amount.replace(/,/g, ""))
          : parseUnits(amount.replace(/,/g, ""), selected.decimals);

      if (value <= 0n) throw new Error("Enter an amount greater than zero.");

      let hash: `0x${string}`;

      if (selected.standard === "erc20") {
        hash = await writeContractAsync({
          address: selected.address,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [vault as Address, value],
        });
      } else {
        hash = await writeContractAsync({
          address: selected.address,
          abi: ERC1155_ABI,
          functionName: "safeTransferFrom",
          args: [address, vault as Address, selected.tokenId || 1n, value, "0x"],
        });
      }

      setMessage("Sending to your land…");
      const client = makeBaseClient();
      await client.waitForTransactionReceipt({ hash });

      setAmount("");
      setMessage(`${selected.label} arrived at Lore Land #${deedId}.`);
      window.dispatchEvent(new CustomEvent("tobyswap:wallet-data-refreshed"));
    } catch (error: any) {
      const text =
        error?.shortMessage ||
        error?.message ||
        "The transfer did not complete.";
      setMessage(
        /reject|denied/i.test(text)
          ? "Transfer cancelled in wallet."
          : text.slice(0, 180),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!isConnected || deedIds.length === 0) return null;

  return (
    <section className="pouch-land-send">
      <div className="pouch-land-send-head">
        <div>
          <span>SEND TO YOUR LAND</span>
          <h2>Pack a Lore Deed</h2>
          <p>
            Move Tobyworld assets from this wallet into the token-bound vault attached to one of your deeds.
          </p>
        </div>
        <div className="pouch-land-send-badge">ONCHAIN</div>
      </div>

      <div className="pouch-land-send-grid">
        <label>
          <small>LORE DEED</small>
          <select value={deedId} onChange={(event) => setDeedId(event.target.value)}>
            {deedIds.map((id) => (
              <option key={id} value={id}>Lore Land #{id}</option>
            ))}
          </select>
        </label>

        <label>
          <small>ASSET</small>
          <select value={assetId} onChange={(event) => setAssetId(event.target.value as AssetId)}>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.label}</option>
            ))}
          </select>
        </label>

        <label className="pouch-land-send-amount">
          <small>AMOUNT</small>
          <div>
            <input
              inputMode={selected.decimals === 0 ? "numeric" : "decimal"}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
            />
            <button
              type="button"
              onClick={() => setAmount(formattedBalance.replace(/,/g, ""))}
            >
              MAX
            </button>
          </div>
          <em>You carry {formattedBalance} {selected.label}</em>
        </label>
      </div>

      <div className="pouch-land-vault-line">
        <span>DESTINATION</span>
        <strong>
          {vault ? `${String(vault).slice(0, 8)}…${String(vault).slice(-6)}` : "Resolving land vault…"}
        </strong>
      </div>

      <button
        type="button"
        className="pouch-land-send-cta"
        disabled={busy || !vault || !amount}
        onClick={() => void send()}
      >
        {busy ? "SENDING…" : `SEND ${selected.label} TO LAND #${deedId}`}
      </button>

      {message ? <div className="pouch-land-send-message">{message}</div> : null}

      <p className="pouch-land-send-note">
        Assets sent here belong to the deed's ERC-6551 vault. Whoever owns the deed controls that vault through the canonical Lore system.
      </p>
    </section>
  );
}
