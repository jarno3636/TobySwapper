"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { base } from "wagmi/chains";
import { TABOSHI_SEEDS_ABI, TABOSHI_SEED_ID } from "@/lib/taboshi-seeds";
import { LEGACY_LORE_DEED_ABI, LORE_DEEDS_ABI } from "@/lib/lore-deeds";
import { MARKETPLACE_ASSETS, MARKETPLACE_FEE_PERCENT, MARKETPLACE_PAYMENTS, type MarketplaceAssetKind, type MarketplacePayment, type TobyworldListing } from "@/lib/land-exchange";

type AssetFilter = "all" | MarketplaceAssetKind;
type PaymentFilter = "all" | MarketplacePayment;
type SortMode = "newest" | "price-low" | "price-high";

const listings: TobyworldListing[] = [];

function assetFor(id: MarketplaceAssetKind) { return MARKETPLACE_ASSETS.find((asset) => asset.id === id)!; }

function AssetVisual({ kind }: { kind: MarketplaceAssetKind }) {
  if (kind === "seed") return <span className="market-asset-art is-seed"><Image src="/seed.png" alt="" fill sizes="62px" className="object-cover" /></span>;
  return <span className={`market-asset-art ${kind === "old-land" ? "is-old-land" : "is-lore-land"}`}><b>△</b><i /></span>;
}

export default function MarketplaceShell() {
  const { address, isConnected } = useAccount();
  const holdingReads = useReadContracts({
    contracts: address ? [
      { address: MARKETPLACE_ASSETS[0].address, abi: TABOSHI_SEEDS_ABI, functionName: "balanceOf", args: [address, TABOSHI_SEED_ID], chainId: base.id },
      { address: MARKETPLACE_ASSETS[1].address, abi: LEGACY_LORE_DEED_ABI, functionName: "balanceOf", args: [address], chainId: base.id },
      { address: MARKETPLACE_ASSETS[2].address, abi: LORE_DEEDS_ABI, functionName: "balanceOf", args: [address], chainId: base.id },
    ] as const : [],
    query: { enabled: Boolean(address), staleTime: 10 * 60_000, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
  });
  const heldByKind: Record<MarketplaceAssetKind, bigint> = {
    seed: typeof holdingReads.data?.[0]?.result === "bigint" ? holdingReads.data[0].result : 0n,
    "old-land": typeof holdingReads.data?.[1]?.result === "bigint" ? holdingReads.data[1].result : 0n,
    "lore-land": typeof holdingReads.data?.[2]?.result === "bigint" ? holdingReads.data[2].result : 0n,
  };

  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [query, setQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<MarketplaceAssetKind>("seed");
  const [selectedPayment, setSelectedPayment] = useState<MarketplacePayment>("USDC");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let next = listings.filter((listing) => (assetFilter === "all" || listing.assetKind === assetFilter) && (paymentFilter === "all" || listing.payment === paymentFilter));
    if (q) next = next.filter((listing) => listing.tokenId?.includes(q) || listing.seller.toLowerCase().includes(q) || assetFor(listing.assetKind).label.toLowerCase().includes(q));
    return [...next].sort((a, b) => sort === "newest" ? b.createdAt.localeCompare(a.createdAt) : sort === "price-low" ? Number(BigInt(a.priceAtomic) - BigInt(b.priceAtomic)) : Number(BigInt(b.priceAtomic) - BigInt(a.priceAtomic)));
  }, [assetFilter, paymentFilter, query, sort]);

  return (
    <div className="marketplace-stack">
      <section className="market-assets-overview" aria-label="Marketplace assets">
        {MARKETPLACE_ASSETS.map((asset) => (
          <button key={asset.id} type="button" className={`market-asset-choice ${selectedAsset === asset.id ? "is-selected" : ""}`} onClick={() => { setSelectedAsset(asset.id); setAssetFilter(asset.id); }}>
            <AssetVisual kind={asset.id} />
            <span><small>{asset.standard}</small><strong>{asset.shortLabel}</strong><em>{asset.note}</em><i className="market-held-line">{isConnected ? `${heldByKind[asset.id].toLocaleString()} held` : "Connect to see yours"}</i></span>
            <b aria-hidden="true">{selectedAsset === asset.id ? "✓" : "→"}</b>
          </button>
        ))}
      </section>

      <section className="market-compose-card">
        <div className="market-compose-copy"><span>LIST AN ASSET</span><h2>Simple by design.</h2><p>Choose what you want to sell, choose how you want to be paid, then set a price. Trading is not open yet, but the path stays simple.</p></div>
        <div className="market-compose-row">
          <label><span>ASSET</span><select value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value as MarketplaceAssetKind)}>{MARKETPLACE_ASSETS.map((asset) => <option key={asset.id} value={asset.id}>{asset.label}</option>)}</select></label>
          <label><span>GET PAID IN</span><select value={selectedPayment} onChange={(e) => setSelectedPayment(e.target.value as MarketplacePayment)}>{MARKETPLACE_PAYMENTS.map((payment) => <option key={payment.id} value={payment.id}>{payment.label}</option>)}</select></label>
          <div className="market-fee-pill"><small>MARKET FEE</small><strong>{MARKETPLACE_FEE_PERCENT}%</strong></div>
        </div>
        <button type="button" className="market-list-button" disabled><span>{isConnected ? `${heldByKind[selectedAsset].toLocaleString()} ${assetFor(selectedAsset).shortLabel} held · market not open yet` : "Connect a wallet to prepare a listing"}</span><b>SOON</b></button>
      </section>

      <section className="market-listings-card">
        <div className="market-listings-head"><div><span>MARKETPLACE</span><h2>Browse listings</h2><p>SEED, Old Lore Land, and Lore Land in one clean market.</p></div><span className="exchange-status">PREVIEW</span></div>

        <div className="market-filterbar">
          <label className="market-search"><span>SEARCH</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Deed #, seller, asset…" /></label>
          <label><span>ASSET</span><select value={assetFilter} onChange={(e) => setAssetFilter(e.target.value as AssetFilter)}><option value="all">All assets</option>{MARKETPLACE_ASSETS.map((asset) => <option key={asset.id} value={asset.id}>{asset.shortLabel}</option>)}</select></label>
          <label><span>PAYMENT</span><select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}><option value="all">Any token</option>{MARKETPLACE_PAYMENTS.map((payment) => <option key={payment.id} value={payment.id}>{payment.label}</option>)}</select></label>
          <label><span>SORT</span><select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}><option value="newest">Newest</option><option value="price-low">Price: low</option><option value="price-high">Price: high</option></select></label>
        </div>

        {visible.length === 0 ? (
          <div className="market-empty-clean"><div className="market-empty-stack"><AssetVisual kind="seed" /><AssetVisual kind="old-land" /><AssetVisual kind="lore-land" /></div><h3>The shelves are ready.</h3><p>There are no live listings yet. When trading opens, SEED and land listings will appear here with the same simple filters.</p><div><a href="/world">Explore World</a><a href="/taboshi1#pouch">Open My Tobyworld</a></div></div>
        ) : <div className="market-grid">{/* future onchain listings render here */}</div>}
      </section>

      <section className="market-rules-strip"><span><b>BASE</b><small>Network</small></span><span><b>USDC · ETH · TOBY</b><small>Payment choices</small></span><span><b>{MARKETPLACE_FEE_PERCENT}%</b><small>Marketplace fee</small></span></section>
    </div>
  );
}
