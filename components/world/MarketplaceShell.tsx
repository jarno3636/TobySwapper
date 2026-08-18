"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { base } from "wagmi/chains";
import { TABOSHI_SEEDS_ABI, TABOSHI_SEED_ID } from "@/lib/taboshi-seeds";
import { LEGACY_LORE_DEED_ABI, LORE_DEEDS_ABI } from "@/lib/lore-deeds";
import {
  LAND_EXCHANGE_ENABLED,
  MARKETPLACE_ASSETS,
  MARKETPLACE_FEE_PERCENT,
  MARKETPLACE_PAYMENTS,
  type MarketplaceAssetKind,
  type MarketplacePayment,
  type TobyworldListing,
} from "@/lib/land-exchange";
import { readMarketplaceListings } from "@/lib/marketplace-listings";

type AssetFilter = "all" | MarketplaceAssetKind;
type PaymentFilter = "all" | MarketplacePayment;
type SortMode = "newest" | "price-low" | "price-high";

function assetFor(id: MarketplaceAssetKind) {
  return MARKETPLACE_ASSETS.find((asset) => asset.id === id)!;
}

function paymentFor(id: MarketplacePayment) {
  return MARKETPLACE_PAYMENTS.find((payment) => payment.id === id)!;
}

function AssetVisual({ kind }: { kind: MarketplaceAssetKind }) {
  if (kind === "seed") {
    return <span className="market-asset-art is-seed"><Image src="/seed.png" alt="" fill sizes="62px" className="object-cover" /></span>;
  }
  return (
    <span className={`market-asset-art ${kind === "old-land" ? "is-old-land" : "is-lore-land"}`}>
      <b>△</b><i />
    </span>
  );
}

function displayListingPrice(listing: TobyworldListing) {
  try {
    const payment = paymentFor(listing.payment);
    const value = formatUnits(BigInt(listing.priceAtomic), payment.decimals);
    const [whole, fraction = ""] = value.split(".");
    const trimmed = fraction.slice(0, payment.id === "USDC" ? 2 : 6).replace(/0+$/, "");
    return `${whole}${trimmed ? `.${trimmed}` : ""} ${payment.label}`;
  } catch {
    return `— ${listing.payment}`;
  }
}

export default function MarketplaceShell() {
  const { address, isConnected } = useAccount();
  const holdingReads = useReadContracts({
    contracts: address ? [
      { address: MARKETPLACE_ASSETS[0].address, abi: TABOSHI_SEEDS_ABI, functionName: "balanceOf", args: [address, TABOSHI_SEED_ID], chainId: base.id },
      { address: MARKETPLACE_ASSETS[1].address, abi: LEGACY_LORE_DEED_ABI, functionName: "balanceOf", args: [address], chainId: base.id },
      { address: MARKETPLACE_ASSETS[2].address, abi: LORE_DEEDS_ABI, functionName: "balanceOf", args: [address], chainId: base.id },
    ] as const : [],
    query: {
      enabled: Boolean(address),
      staleTime: 10 * 60_000,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });

  const heldByKind: Record<MarketplaceAssetKind, bigint> = {
    seed: typeof holdingReads.data?.[0]?.result === "bigint" ? holdingReads.data[0].result : 0n,
    "old-land": typeof holdingReads.data?.[1]?.result === "bigint" ? holdingReads.data[1].result : 0n,
    "lore-land": typeof holdingReads.data?.[2]?.result === "bigint" ? holdingReads.data[2].result : 0n,
  };

  const [listings, setListings] = useState<TobyworldListing[]>([]);
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [query, setQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<MarketplaceAssetKind>("seed");
  const [selectedPayment, setSelectedPayment] = useState<MarketplacePayment>("USDC");
  const [assetDetail, setAssetDetail] = useState("1");
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (!LAND_EXCHANGE_ENABLED) return;
    let cancelled = false;
    readMarketplaceListings().then((rows) => { if (!cancelled) setListings(rows); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setAssetDetail("1");
  }, [selectedAsset]);

  const chosenAsset = assetFor(selectedAsset);
  const numericPrice = Number(price);
  const validPrice = Number.isFinite(numericPrice) && numericPrice > 0;
  const feePreview = validPrice ? numericPrice * (MARKETPLACE_FEE_PERCENT / 100) : 0;
  const receivePreview = validPrice ? numericPrice - feePreview : 0;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let next = listings.filter((listing) =>
      (assetFilter === "all" || listing.assetKind === assetFilter) &&
      (paymentFilter === "all" || listing.payment === paymentFilter),
    );
    if (q) {
      next = next.filter((listing) =>
        listing.tokenId?.includes(q) ||
        listing.seller.toLowerCase().includes(q) ||
        assetFor(listing.assetKind).label.toLowerCase().includes(q),
      );
    }
    return [...next].sort((a, b) => {
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (a.payment !== b.payment) return a.payment.localeCompare(b.payment);
      const av = BigInt(a.priceAtomic);
      const bv = BigInt(b.priceAtomic);
      if (av === bv) return 0;
      return sort === "price-low" ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });
  }, [assetFilter, listings, paymentFilter, query, sort]);

  return (
    <div className="marketplace-stack">
      <section className="market-assets-overview" aria-label="Marketplace assets">
        {MARKETPLACE_ASSETS.map((asset) => (
          <button
            key={asset.id}
            type="button"
            className={`market-asset-choice ${selectedAsset === asset.id ? "is-selected" : ""}`}
            onClick={() => { setSelectedAsset(asset.id); setAssetFilter(asset.id); }}
          >
            <AssetVisual kind={asset.id} />
            <span>
              <small>{asset.standard}</small>
              <strong>{asset.shortLabel}</strong>
              <em>{asset.note}</em>
              <i className="market-held-line">{isConnected ? `${heldByKind[asset.id].toLocaleString()} held` : "Connect to see yours"}</i>
            </span>
            <b aria-hidden="true">{selectedAsset === asset.id ? "✓" : "→"}</b>
          </button>
        ))}
      </section>

      <section className="market-compose-card market-compose-card-v2">
        <div className="market-compose-head">
          <div className="market-compose-copy">
            <span>PREPARE A LISTING</span>
            <h2>Three steps. Nothing hidden.</h2>
            <p>Choose an asset, set what you are selling, then choose a Base payment and price.</p>
          </div>
          <span className="market-fee-badge"><b>{MARKETPLACE_FEE_PERCENT}%</b><small>market fee</small></span>
        </div>

        <div className="market-listing-steps">
          <label>
            <span><i>1</i> ASSET</span>
            <select value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value as MarketplaceAssetKind)}>
              {MARKETPLACE_ASSETS.map((asset) => <option key={asset.id} value={asset.id}>{asset.label}</option>)}
            </select>
          </label>
          <label>
            <span><i>2</i> {chosenAsset.quantityBased ? "QUANTITY" : "DEED ID"}</span>
            <input
              inputMode="numeric"
              value={assetDetail}
              onChange={(e) => setAssetDetail(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder={chosenAsset.quantityBased ? "SEED amount" : "Token ID"}
            />
          </label>
          <label>
            <span><i>3</i> GET PAID IN</span>
            <select value={selectedPayment} onChange={(e) => setSelectedPayment(e.target.value as MarketplacePayment)}>
              {MARKETPLACE_PAYMENTS.map((payment) => <option key={payment.id} value={payment.id}>{payment.label}</option>)}
            </select>
          </label>
          <label>
            <span>PRICE</span>
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={`0 ${selectedPayment}`} />
          </label>
        </div>

        <div className="market-listing-summary">
          <div><small>YOU HOLD</small><strong>{heldByKind[selectedAsset].toLocaleString()} {chosenAsset.shortLabel}</strong></div>
          <div><small>MARKET FEE</small><strong>{validPrice ? `${feePreview.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${selectedPayment}` : `${MARKETPLACE_FEE_PERCENT}%`}</strong></div>
          <div><small>YOU RECEIVE</small><strong>{validPrice ? `${receivePreview.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${selectedPayment}` : "—"}</strong></div>
        </div>

        <button type="button" className="market-list-button" disabled>
          <span>{isConnected ? "Listing opens with the Tobyworld market contract" : "Connect a wallet to prepare a listing"}</span>
          <b>SOON</b>
        </button>
      </section>

      <section className="market-listings-card">
        <div className="market-listings-head">
          <div><span>MARKETPLACE</span><h2>Browse listings</h2><p>SEED, Old Lore Land, and Canonical Lore Land in one market.</p></div>
          <span className="exchange-status">{LAND_EXCHANGE_ENABLED ? "LIVE" : "PREVIEW"}</span>
        </div>

        <div className="market-quick-filters" aria-label="Asset filters">
          <button type="button" className={assetFilter === "all" ? "is-active" : ""} onClick={() => setAssetFilter("all")}>All</button>
          {MARKETPLACE_ASSETS.map((asset) => <button key={asset.id} type="button" className={assetFilter === asset.id ? "is-active" : ""} onClick={() => setAssetFilter(asset.id)}>{asset.shortLabel}</button>)}
        </div>

        <div className="market-filterbar">
          <label className="market-search"><span>SEARCH</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Deed #, seller, asset…" /></label>
          <label><span>PAYMENT</span><select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}><option value="all">Any token</option>{MARKETPLACE_PAYMENTS.map((payment) => <option key={payment.id} value={payment.id}>{payment.label}</option>)}</select></label>
          <label><span>SORT</span><select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}><option value="newest">Newest</option><option value="price-low">Price: low</option><option value="price-high">Price: high</option></select></label>
        </div>

        {visible.length === 0 ? (
          <div className="market-empty-clean">
            <div className="market-empty-stack"><AssetVisual kind="seed" /><AssetVisual kind="old-land" /><AssetVisual kind="lore-land" /></div>
            <h3>The shelves are ready.</h3>
            <p>No live listings yet. These three assets will appear here when trading opens.</p>
            <div><a href="/world">Explore World</a><a href="/taboshi1#pouch">Open My Tobyworld</a></div>
          </div>
        ) : (
          <div className="market-grid">
            {visible.map((listing) => (
              <article key={listing.listingId} className="market-listing-tile">
                <AssetVisual kind={listing.assetKind} />
                <div className="market-listing-tile-copy">
                  <small>{assetFor(listing.assetKind).shortLabel}</small>
                  <h3>{listing.assetKind === "seed" ? `${listing.quantity || "—"} SEED` : `Deed #${listing.tokenId || "—"}`}</h3>
                  <p>{`${listing.seller.slice(0, 6)}…${listing.seller.slice(-4)}`}</p>
                </div>
                <div className="market-listing-tile-price"><small>PRICE</small><strong>{displayListingPrice(listing)}</strong></div>
                <button type="button" disabled>View listing</button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="market-rules-strip">
        <span><b>BASE</b><small>Network</small></span>
        <span><b>USDC · ETH · TOBY</b><small>Payment choices</small></span>
        <span><b>{MARKETPLACE_FEE_PERCENT}%</b><small>Marketplace fee</small></span>
      </section>
    </div>
  );
}
