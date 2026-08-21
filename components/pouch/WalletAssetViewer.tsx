"use client";

import { useMemo } from "react";
import Image from "next/image";
import { formatUnits, type Address } from "viem";
import { base } from "viem/chains";
import { useReadContract } from "wagmi";
import MyLoreDeeds from "@/components/land/MyLoreDeeds";
import PublicPouchCreator from "@/components/pouch/PublicPouchCreator";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { TOBY, PATIENCE, TABOSHI, CBBTC } from "@/lib/addresses";
import { TABOSHI1_ABI, TABOSHI1_ADDRESS, TABOSHI1_TOKEN_ID } from "@/lib/taboshi1";
import { TABOSHI_SEEDS_ABI, TABOSHI_SEEDS_ADDRESS, TABOSHI_SEED_ID } from "@/lib/taboshi-seeds";
import {
  LORE_COLLECTION_ADDRESS,
  LORE_DEEDS_ABI,
  LEGACY_LORE_DEED_ADDRESS,
  LEGACY_LORE_DEED_ABI,
} from "@/lib/lore-deeds";

function compact(value?: bigint, decimals = 18) {
  if (value === undefined) return "…";
  if (decimals === 0) return value.toLocaleString();
  const number = Number(formatUnits(value, decimals));
  if (!Number.isFinite(number) || number === 0) return "0";
  if (number >= 1e9) return `${(number / 1e9).toFixed(number >= 1e10 ? 0 : 1)}B`;
  if (number >= 1e6) return `${(number / 1e6).toFixed(number >= 1e7 ? 0 : 1)}M`;
  if (number >= 1e3) return number.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return number.toLocaleString(undefined, { maximumSignificantDigits: 6 });
}

export default function WalletAssetViewer({
  owner,
  onClose,
  profileMode = false,
}: {
  owner: Address;
  onClose?: () => void;
  profileMode?: boolean;
}) {
  const toby = useTokenBalance(owner, TOBY, { chainId: base.id });
  const patience = useTokenBalance(owner, PATIENCE, { chainId: base.id });
  const taboshi = useTokenBalance(owner, TABOSHI, { chainId: base.id });
  const cbbtc = useTokenBalance(owner, CBBTC, { chainId: base.id });

  const leaf = useReadContract({
    address: TABOSHI1_ADDRESS,
    abi: TABOSHI1_ABI,
    functionName: "balanceOf",
    args: [owner, TABOSHI1_TOKEN_ID],
    chainId: base.id,
    query: { staleTime: 30_000, refetchInterval: false, refetchOnWindowFocus: false },
  });

  const seed = useReadContract({
    address: TABOSHI_SEEDS_ADDRESS,
    abi: TABOSHI_SEEDS_ABI,
    functionName: "balanceOf",
    args: [owner, TABOSHI_SEED_ID],
    chainId: base.id,
    query: { staleTime: 30_000, refetchInterval: false, refetchOnWindowFocus: false },
  });

  const lore = useReadContract({
    address: LORE_COLLECTION_ADDRESS,
    abi: LORE_DEEDS_ABI,
    functionName: "balanceOf",
    args: [owner],
    chainId: base.id,
    query: { staleTime: 30_000, refetchInterval: false, refetchOnWindowFocus: false },
  });

  const oldLore = useReadContract({
    address: LEGACY_LORE_DEED_ADDRESS,
    abi: LEGACY_LORE_DEED_ABI,
    functionName: "balanceOf",
    args: [owner],
    chainId: base.id,
    query: { staleTime: 60_000, refetchInterval: false, refetchOnWindowFocus: false, retry: false },
  });

  const values = useMemo(() => {
    const leafValue = typeof leaf.data === "bigint" ? leaf.data : 0n;
    const seedValue = typeof seed.data === "bigint" ? seed.data : 0n;
    const loreValue = typeof lore.data === "bigint" ? lore.data : 0n;
    const oldLoreValue = typeof oldLore.data === "bigint" ? oldLore.data : 0n;

    return [
      { symbol: "TOBY", note: "Pond token", image: "/tokens/toby.PNG", value: compact(toby.value, toby.decimals) },
      { symbol: "PATIENCE", note: "Ancient flame", image: "/ui/patience.webp", value: compact(patience.value, patience.decimals) },
      { symbol: "TABOSHI", note: "Awakened leaf", image: "/ui/taboshi.webp", value: compact(taboshi.value, taboshi.decimals) },
      { symbol: "cbBTC", note: "Bitcoin on Base", image: "/tokens/cbbtc.svg", value: compact(cbbtc.value, cbbtc.decimals) },
      { symbol: "OLD LEAF", note: "Taboshi 1", image: "/ui/taboshi.webp", value: leafValue.toLocaleString() },
      { symbol: "SEED", note: "New seed", image: "/ui/seed.webp", value: seedValue.toLocaleString() },
      { symbol: "LORE LAND", note: "Canonical deed", image: null, value: loreValue.toLocaleString(), lore: true },
      { symbol: "OLD LAND", note: "Previous collection", image: null, value: oldLoreValue.toLocaleString(), oldLand: true },
    ];
  }, [
    leaf.data,
    lore.data,
    oldLore.data,
    patience.decimals,
    patience.value,
    seed.data,
    cbbtc.decimals,
    cbbtc.value,
    taboshi.decimals,
    taboshi.value,
    toby.decimals,
    toby.value,
  ]);

  const loreCount = typeof lore.data === "bigint" ? lore.data : 0n;

  return (
    <div className="watch-pouch-results">
      <div className="watch-pouch-results-head">
        <div>
          <span>{profileMode ? "TOBYWORLD POUCH" : "READ-ONLY POUCH"}</span>
          <strong>{`${owner.slice(0, 8)}…${owner.slice(-6)}`}</strong>
          <small>{profileMode ? "Live public holdings on Base" : "Public Base holdings · no wallet connection required"}</small>
        </div>
        {onClose ? <button type="button" onClick={onClose}>Close</button> : null}
      </div>

      <div className="watch-pouch-grid">
        {values.map((asset) => (
          <div key={asset.symbol} className={`watch-pouch-asset ${asset.lore ? "is-lore" : ""}`}>
            <div className="watch-pouch-icon">
              {asset.image ? (
                <Image src={asset.image} alt="" width={46} height={46} />
              ) : (
                <span>{asset.oldLand ? "△" : "LORE"}</span>
              )}
            </div>
            <div>
              <small>{asset.note}</small>
              <strong>{asset.symbol}</strong>
            </div>
            <b>{asset.value}</b>
          </div>
        ))}
      </div>

      {loreCount > 0n ? (
        <MyLoreDeeds owner={owner} expectedCount={loreCount} revealed readOnly />
      ) : null}

      {!profileMode ? (
        <>
          <PublicPouchCreator walletAddress={owner} compact />
          <div className="watch-pouch-note">
            This is a public, read-only view. Connecting a wallet is only required to transfer,
            trade, edit canonical land, or move assets into a Land Vault.
          </div>
        </>
      ) : null}
    </div>
  );
}
