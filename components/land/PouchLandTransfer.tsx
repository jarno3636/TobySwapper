"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits, getAddress, parseUnits, type Address } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { makeBaseClient } from "@/lib/rpc";
import {
  CANONICAL_LORE_LAND,
  CANONICAL_LORE_ABI,
  LEGACY_LORE_DEED_ADDRESS,
  LEGACY_LORE_DEED_ABI,
} from "@/lib/lore-deeds";
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

type AssetId = "TOBY" | "PATIENCE" | "TABOSHI" | "OLD_LEAF" | "SEED" | "OLD_LAND";
type AssetStandard = "erc20" | "erc1155" | "erc721";

type VaultPackingAsset = {
  id: AssetId;
  label: string;
  address: Address;
  decimals: number;
  standard: AssetStandard;
  tokenId?: bigint;
};

const assets: VaultPackingAsset[] = [
  { id: "TOBY", label: "TOBY", address: TOBY, decimals: 18, standard: "erc20" },
  { id: "PATIENCE", label: "PATIENCE", address: PATIENCE, decimals: 18, standard: "erc20" },
  { id: "TABOSHI", label: "TABOSHI", address: TABOSHI, decimals: 18, standard: "erc20" },
  { id: "OLD_LEAF", label: "OLD LEAF", address: TABOSHI1_ADDRESS, decimals: 0, standard: "erc1155", tokenId: TABOSHI1_TOKEN_ID },
  { id: "SEED", label: "SEED", address: TABOSHI_SEEDS_ADDRESS, decimals: 0, standard: "erc1155", tokenId: TABOSHI_SEED_ID },
  { id: "OLD_LAND", label: "OLD LORE LAND", address: LEGACY_LORE_DEED_ADDRESS, decimals: 0, standard: "erc721" },
];

export function PouchLandTransfer({ deedIds }: { deedIds: string[] }) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [deedId, setDeedId] = useState(deedIds[0] || "");
  const [assetId, setAssetId] = useState<AssetId>("SEED");
  const [amount, setAmount] = useState("");
  const [assetTokenId, setAssetTokenId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!deedIds.includes(deedId) && deedIds[0]) setDeedId(deedIds[0]);
  }, [deedId, deedIds]);

  useEffect(() => {
    function onSelect(event: Event) {
      const tokenId = String((event as CustomEvent<{ tokenId?: string }>).detail?.tokenId || "");
      if (tokenId && deedIds.includes(tokenId)) setDeedId(tokenId);
    }
    window.addEventListener("tobyswap:select-land-vault", onSelect);
    return () => window.removeEventListener("tobyswap:select-land-vault", onSelect);
  }, [deedIds]);

  const selected = useMemo(
    () => assets.find((asset) => asset.id === assetId) || assets[0],
    [assetId],
  );

  useEffect(() => {
    setAmount("");
    setAssetTokenId("");
    setMessage("");
  }, [assetId]);

  const { data: vault } = useReadContract({
    address: CANONICAL_LORE_LAND,
    abi: CANONICAL_LORE_ABI,
    functionName: "accountOf",
    args: deedId ? [BigInt(deedId)] : undefined,
    query: { enabled: Boolean(deedId), staleTime: 60_000, refetchOnMount: true },
  });

  const balanceRead = useReadContract({
    address: selected.address,
    abi:
      selected.standard === "erc20"
        ? ERC20_ABI
        : selected.standard === "erc1155"
          ? ERC1155_ABI
          : LEGACY_LORE_DEED_ABI,
    functionName: "balanceOf",
    args:
      !address
        ? undefined
        : selected.standard === "erc1155"
          ? [address, selected.tokenId || 1n]
          : [address],
    query: { enabled: Boolean(address), staleTime: 15_000, refetchOnMount: "always" },
  } as any);

  const formattedBalance = useMemo(() => {
    try {
      if (typeof balanceRead.data !== "bigint") return "0";
      return selected.decimals === 0
        ? balanceRead.data.toString()
        : Number(formatUnits(balanceRead.data, selected.decimals)).toLocaleString(undefined, {
            maximumFractionDigits: 4,
          });
    } catch {
      return "0";
    }
  }, [balanceRead.data, selected]);

  const canSend = Boolean(
    address &&
      vault &&
      deedId &&
      !busy &&
      (selected.standard === "erc721" ? assetTokenId : amount),
  );

  async function send() {
    if (!address || !vault || !deedId) return;
    if (selected.standard !== "erc721" && !amount) return;
    if (selected.standard === "erc721" && !assetTokenId) return;

    setBusy(true);
    setMessage("Opening your wallet…");

    try {
      let hash: `0x${string}`;

      if (selected.standard === "erc20") {
        const value = parseUnits(amount.replace(/,/g, ""), selected.decimals);
        if (value <= 0n) throw new Error("Enter an amount greater than zero.");
        hash = await writeContractAsync({
          address: selected.address,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [vault as Address, value],
        });
      } else if (selected.standard === "erc1155") {
        const value = BigInt(amount.replace(/,/g, ""));
        if (value <= 0n) throw new Error("Enter an amount greater than zero.");
        hash = await writeContractAsync({
          address: selected.address,
          abi: ERC1155_ABI,
          functionName: "safeTransferFrom",
          args: [address, vault as Address, selected.tokenId || 1n, value, "0x"],
        });
      } else {
        const oldLandTokenId = BigInt(assetTokenId);
        const client = makeBaseClient();
        const currentOwner = await client.readContract({
          address: LEGACY_LORE_DEED_ADDRESS,
          abi: LEGACY_LORE_DEED_ABI,
          functionName: "ownerOf",
          args: [oldLandTokenId],
        });
        if (getAddress(currentOwner as Address) !== getAddress(address)) {
          throw new Error(`Old Lore Land #${assetTokenId} is not owned by this wallet.`);
        }
        hash = await writeContractAsync({
          address: LEGACY_LORE_DEED_ADDRESS,
          abi: LEGACY_LORE_DEED_ABI,
          functionName: "safeTransferFrom",
          args: [address, vault as Address, oldLandTokenId],
        });
      }

      setMessage("Sending to your land…");
      const client = makeBaseClient();
      await client.waitForTransactionReceipt({ hash });

      setAmount("");
      setAssetTokenId("");
      setMessage(
        selected.standard === "erc721"
          ? `Old Lore Land #${assetTokenId} arrived at Lore Land #${deedId}.`
          : `${selected.label} arrived at Lore Land #${deedId}.`,
      );
      window.dispatchEvent(new CustomEvent("tobyswap:wallet-data-refreshed"));
    } catch (error: any) {
      const text = error?.shortMessage || error?.message || "The transfer did not complete.";
      setMessage(/reject|denied/i.test(text) ? "Transfer cancelled in wallet." : text.slice(0, 180));
    } finally {
      setBusy(false);
    }
  }

  if (!isConnected || deedIds.length === 0) return null;

  return (
    <section id="land-vault-send" className="pouch-land-send scroll-mt-24">
      <div className="pouch-land-send-head">
        <div>
          <span>SEND TO YOUR LAND</span>
          <h2>Pack a Lore Deed</h2>
          <p>Choose one of your deeds and pack Tobyworld assets into its token-bound vault.</p>
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
          <small>{selected.standard === "erc721" ? "OLD LAND TOKEN ID" : "AMOUNT"}</small>
          <div>
            <input
              inputMode={selected.standard === "erc20" ? "decimal" : "numeric"}
              value={selected.standard === "erc721" ? assetTokenId : amount}
              onChange={(event) => {
                const value = selected.standard === "erc20"
                  ? event.target.value.replace(/[^0-9.]/g, "")
                  : event.target.value.replace(/\D/g, "");
                if (selected.standard === "erc721") setAssetTokenId(value);
                else setAmount(value);
              }}
              placeholder={selected.standard === "erc721" ? "e.g. 42" : "0"}
            />
            {selected.standard !== "erc721" ? (
              <button type="button" onClick={() => setAmount(formattedBalance.replace(/,/g, ""))}>MAX</button>
            ) : null}
          </div>
          <em>
            {selected.standard === "erc721"
              ? `You carry ${formattedBalance} Old Lore Land deed${formattedBalance === "1" ? "" : "s"}. Enter the token ID you want to pack.`
              : `You carry ${formattedBalance} ${selected.label}`}
          </em>
        </label>
      </div>

      <div className="pouch-land-vault-line">
        <span>DESTINATION</span>
        <strong>{vault ? `${String(vault).slice(0, 8)}…${String(vault).slice(-6)}` : "Resolving land vault…"}</strong>
      </div>

      <button type="button" className="pouch-land-send-cta" disabled={!canSend} onClick={() => void send()}>
        {busy
          ? "SENDING…"
          : selected.standard === "erc721"
            ? `SEND OLD LAND #${assetTokenId || "—"} TO LAND #${deedId}`
            : `SEND ${selected.label} TO LAND #${deedId}`}
      </button>

      {message ? <div className="pouch-land-send-message">{message}</div> : null}

      <div className="land-vault-travel-warning" role="note">
        <span aria-hidden="true">!</span>
        <p><strong>Assets travel with the deed.</strong> Anything left inside this vault stays with the NFT if the Lore Deed is transferred. Unpack anything you want to keep first.</p>
      </div>
    </section>
  );
}
