"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { erc20Abi, type Address } from "viem";
import { base } from "viem/chains";
import { useReadContract } from "wagmi";
import { BASESCAN, TABOSHI } from "@/lib/addresses";

const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD" as Address;
const TOBY = "0xb8D98a102b0079B69FFbc760C8d857A31653e56e" as Address;
const PATIENCE = "0x6D96f18F00B815B2109A3766E79F6A7aD7785624" as Address;
const TABOSHI_ONE = "0x5C0BF08936bcCfbb6af24B4648A9fb365cAa2F4e" as Address;
const SEED = "0x02C97bfFEAe8406A3050C83185314B001D84b802" as Address;
const OLD_LAND = "0x08f74Dd2913d7A7a4C7339B9106AE14654265b62" as Address;
const LORE_LAND = "0x0495601Af6f86efb14C9D478eA46b2Aa09cB164A" as Address;

type AssetId = "toby" | "patience" | "taboshi" | "old-leaf" | "seed" | "old-land" | "lore-land" | "satoby";

type Asset = {
  id: AssetId;
  name: string;
  eyebrow: string;
  image: string;
  address?: Address;
  description: string;
  note?: string;
};

const ASSETS: Asset[] = [
  {
    id: "toby",
    name: "TOBY",
    eyebrow: "POND TOKEN",
    image: "/tokens/toby.PNG",
    address: TOBY,
    description: "The social heartbeat of Tobyworld — a community token that moves through the pond, the apps, and the rituals built around them.",
    note: "A simple frog token became the first recognizable signal of the wider world.",
  },
  {
    id: "patience",
    name: "PATIENCE",
    eyebrow: "ANCIENT FLAME",
    image: "/ui/patience.webp",
    address: PATIENCE,
    description: "A scarce Tobyworld token built around the idea that time and conviction matter. Lore repeatedly frames PATIENCE as a key between older relics and whatever comes next.",
    note: "Easy to claim. Difficult to own. The pond has always rewarded those who wait.",
  },
  {
    id: "taboshi",
    name: "TABOSHI",
    eyebrow: "LEAF OF YIELD",
    image: "/ui/taboshi.webp",
    address: TABOSHI,
    description: "The awakened leaf. TABOSHI was forged at the close of an earlier Tobyworld epoch and has become increasingly scarce as leaves are sent permanently to the burn address.",
    note: "Its effective circulating world shrinks as the dead wallet grows.",
  },
  {
    id: "old-leaf",
    name: "TABOSHI 1",
    eyebrow: "OLD LEAF",
    image: "/ui/taboshi.webp",
    address: TABOSHI_ONE,
    description: "The historical leaf that came before awakened TABOSHI. Recent Faucet mechanics gave Old Leaves a new role: they can be returned during SEED purchases to increase the number of seeds received.",
    note: "Old leaves return. New seeds wake.",
  },
  {
    id: "seed",
    name: "SEED",
    eyebrow: "NEW BEGINNING",
    image: "/ui/seed.webp",
    address: SEED,
    description: "A new Tobyworld relic whose full purpose has deliberately not been revealed. Seeds are being sown now, while the tap runs, with no promise that the same door remains open forever.",
    note: "What grows from seeds, few will know — until the studied lore begins to show.",
  },
  {
    id: "old-land",
    name: "OLD LORE LAND",
    eyebrow: "FIRST MAP",
    image: "/ui/old-lore.webp",
    address: OLD_LAND,
    description: "The earlier Lore Land collection — a history asset from before the current canonical map. It remains part of Tobyworld's provenance even as the world has moved to its canonical deeds.",
    note: "The first map is not the final world, but it still remembers where the path began.",
  },
  {
    id: "lore-land",
    name: "CANONICAL LORE LAND",
    eyebrow: "A PLACE IN TOBYWORLD",
    image: "/tokens/new-lore.png",
    address: LORE_LAND,
    description: "Canonical Lore Deeds anchor persistent places in Tobyworld. Each deed remembers a land, a keeper, and a world that may reveal gardens, relics, cores, doors, strengths, weaknesses, or things not yet named.",
    note: "Some worlds are found. Others slowly remember you.",
  },
  {
    id: "satoby",
    name: "SATOBY",
    eyebrow: "THE FLOW",
    image: "/ui/sato.webp",
    description: "Satoby is not a tradable asset here. Its true nature remains unrevealed, but the lore repeatedly points toward a flow or engine connecting Tobyworld's assets in a larger flywheel.",
    note: "Not everything in the pond is meant to be held. Some things may exist to make the rest move.",
  },
];

function token18(value?: bigint) {
  if (value === undefined) return "…";
  const n = Number(value) / 1e18;
  if (!Number.isFinite(n)) return "…";
  return n.toLocaleString(undefined, { maximumFractionDigits: n >= 1000 ? 0 : 2 });
}

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export default function TobyworldAssets() {
  const [selected, setSelected] = useState<Asset | null>(null);

  const live = {
    chainId: base.id,
    query: {
      staleTime: 60_000,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  } as const;

  const burnRead = useReadContract({ address: TABOSHI, abi: erc20Abi, functionName: "balanceOf", args: [DEAD_ADDRESS], ...live });
  const supplyRead = useReadContract({ address: TABOSHI, abi: erc20Abi, functionName: "totalSupply", ...live });
  const burned = typeof burnRead.data === "bigint" ? burnRead.data : undefined;
  const supply = typeof supplyRead.data === "bigint" ? supplyRead.data : undefined;
  const burnPct = useMemo(() => {
    if (burned === undefined || supply === undefined || supply === 0n) return undefined;
    return (Number(burned) / Number(supply)) * 100;
  }, [burned, supply]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [selected]);

  return (
    <section className="tw-assets" aria-labelledby="tw-assets-title">
      <div className="tw-assets-head">
        <div>
          <span className="tw-assets-eyebrow">KNOW THE POND</span>
          <h2 id="tw-assets-title">Tobyworld assets</h2>
          <p>A quick field guide to the tokens, relics and lands moving through Tobyworld.</p>
        </div>
        <span className="tw-assets-hint">Tap an asset to open its lore</span>
      </div>

      <div className="tw-assets-grid">
        {ASSETS.map((asset) => (
          <button key={asset.id} type="button" className={`tw-asset-chip is-${asset.id}`} onClick={() => setSelected(asset)}>
            <span className="tw-asset-art"><Image src={asset.image} alt="" fill sizes="54px" className="object-contain" /></span>
            <span className="tw-asset-chip-copy"><small>{asset.eyebrow}</small><strong>{asset.name}</strong></span>
            {asset.id === "taboshi" && <span className="tw-asset-live"><i /> LIVE BURN</span>}
            {asset.id === "satoby" && <span className="tw-asset-mystery">?</span>}
          </button>
        ))}
      </div>

      <p className="tw-assets-footnote">A lore guide, not financial advice. Onchain links open BaseScan.</p>

      {selected && (
        <div className="tw-asset-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }}>
          <div className="tw-asset-modal" role="dialog" aria-modal="true" aria-labelledby="tw-asset-modal-title">
            <button type="button" className="tw-asset-modal-close" onClick={() => setSelected(null)} aria-label="Close asset details">×</button>
            <div className="tw-asset-modal-top">
              <span className="tw-asset-modal-art"><Image src={selected.image} alt="" fill sizes="78px" className="object-contain" /></span>
              <div><span>{selected.eyebrow}</span><h3 id="tw-asset-modal-title">{selected.name}</h3>{selected.address && <code>{shortAddress(selected.address)}</code>}</div>
            </div>

            <p className="tw-asset-modal-copy">{selected.description}</p>
            {selected.note && <blockquote>{selected.note}</blockquote>}

            {selected.id === "taboshi" && (
              <div className="tw-asset-burn-panel">
                <span><small>IN BURN ADDRESS</small><strong>{token18(burned)} TABOSHI</strong></span>
                <span><small>FIXED SUPPLY BURNED</small><strong>{burnPct === undefined ? "…" : `${burnPct.toFixed(2)}%`}</strong></span>
                <p>Read directly from the TABOSHI contract and <code>0x…dEaD</code>. No server-side scan required.</p>
              </div>
            )}

            <div className="tw-asset-modal-actions">
              {selected.address ? (
                <>
                  <a href={`${BASESCAN}/address/${selected.address}`} target="_blank" rel="noreferrer">View contract on BaseScan <span>↗</span></a>
                  {selected.id === "taboshi" && <a className="is-secondary" href={`${BASESCAN}/address/${DEAD_ADDRESS}`} target="_blank" rel="noreferrer">Open burn address <span>↗</span></a>}
                </>
              ) : (
                <span className="tw-asset-unrevealed">No contract to follow — Satoby remains unrevealed.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
