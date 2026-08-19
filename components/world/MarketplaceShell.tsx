"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useReadContracts, useSignMessage } from "wagmi";
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
import {
  clearMarketplaceRequestCache,
  marketplaceRequestCancelMessage,
  marketplaceRequestMessage,
  readMarketplaceRequests,
  type MarketplaceRequest,
} from "@/lib/marketplace-requests";

type AssetFilter = "all" | MarketplaceAssetKind;
type PaymentFilter = "all" | MarketplacePayment;
type SortMode = "newest" | "price-low" | "price-high";
type MarketView = "sale" | "wanted";

function assetFor(id: MarketplaceAssetKind) {
  return MARKETPLACE_ASSETS.find((asset) => asset.id === id)!;
}

function paymentFor(id: MarketplacePayment) {
  return MARKETPLACE_PAYMENTS.find((payment) => payment.id === id)!;
}

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
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

function displayAtomic(valueAtomic: string, paymentId: MarketplacePayment) {
  try {
    const payment = paymentFor(paymentId);
    const value = formatUnits(BigInt(valueAtomic), payment.decimals);
    const [whole, fraction = ""] = value.split(".");
    const trimmed = fraction.slice(0, payment.id === "USDC" ? 2 : 6).replace(/0+$/, "");
    return `${whole}${trimmed ? `.${trimmed}` : ""} ${payment.label}`;
  } catch {
    return `— ${paymentId}`;
  }
}

function displayListingPrice(listing: TobyworldListing) {
  return displayAtomic(listing.priceAtomic, listing.payment);
}

function displayRequestBudget(request: MarketplaceRequest) {
  return displayAtomic(request.budgetAtomic, request.payment);
}

function defaultExpiry() {
  return new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
}

export default function MarketplaceShell() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const holdingReads = useReadContracts({
    contracts: address ? [
      { address: MARKETPLACE_ASSETS[0].address, abi: TABOSHI_SEEDS_ABI, functionName: "balanceOf", args: [address, TABOSHI_SEED_ID], chainId: base.id },
      { address: MARKETPLACE_ASSETS[1].address, abi: LEGACY_LORE_DEED_ABI, functionName: "balanceOf", args: [address], chainId: base.id },
      { address: MARKETPLACE_ASSETS[2].address, abi: LORE_DEEDS_ABI, functionName: "balanceOf", args: [address], chainId: base.id },
    ] as const : [],
    query: {
      enabled: Boolean(address),
      staleTime: 0,
      refetchInterval: false,
      refetchOnMount: "always",
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  });

  const heldByKind: Record<MarketplaceAssetKind, bigint> = {
    seed: typeof holdingReads.data?.[0]?.result === "bigint" ? holdingReads.data[0].result : 0n,
    "old-land": typeof holdingReads.data?.[1]?.result === "bigint" ? holdingReads.data[1].result : 0n,
    "lore-land": typeof holdingReads.data?.[2]?.result === "bigint" ? holdingReads.data[2].result : 0n,
  };

  const [marketView, setMarketView] = useState<MarketView>("sale");
  const [listings, setListings] = useState<TobyworldListing[]>([]);
  const [requests, setRequests] = useState<MarketplaceRequest[]>([]);
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [query, setQuery] = useState("");

  const [selectedAsset, setSelectedAsset] = useState<MarketplaceAssetKind>("seed");
  const [selectedPayment, setSelectedPayment] = useState<MarketplacePayment>("USDC");
  const [assetDetail, setAssetDetail] = useState("1");
  const [price, setPrice] = useState("");

  const [requestAsset, setRequestAsset] = useState<MarketplaceAssetKind>("seed");
  const [requestDetail, setRequestDetail] = useState("1");
  const [requestPayment, setRequestPayment] = useState<MarketplacePayment>("USDC");
  const [requestBudget, setRequestBudget] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requestState, setRequestState] = useState<"idle" | "signing" | "saving" | "success" | "error">("idle");
  const [requestMessage, setRequestMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (LAND_EXCHANGE_ENABLED) {
      readMarketplaceListings().then((rows) => { if (!cancelled) setListings(rows); });
    }
    readMarketplaceRequests().then((rows) => { if (!cancelled) setRequests(rows); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setAssetDetail("1");
  }, [selectedAsset]);

  useEffect(() => {
    setRequestDetail(requestAsset === "seed" ? "1" : "");
  }, [requestAsset]);

  const chosenAsset = assetFor(selectedAsset);
  const requestChosenAsset = assetFor(requestAsset);
  const numericPrice = Number(price);
  const validPrice = Number.isFinite(numericPrice) && numericPrice > 0;
  const feePreview = validPrice ? numericPrice * (MARKETPLACE_FEE_PERCENT / 100) : 0;
  const receivePreview = validPrice ? numericPrice - feePreview : 0;

  const visibleListings = useMemo(() => {
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

  const visibleRequests = useMemo(() => {
    const q = query.trim().toLowerCase();
    let next = requests.filter((item) =>
      (assetFilter === "all" || item.assetKind === assetFilter) &&
      (paymentFilter === "all" || item.payment === paymentFilter),
    );
    if (q) {
      next = next.filter((item) =>
        item.tokenId?.includes(q) ||
        item.requester.toLowerCase().includes(q) ||
        item.note?.toLowerCase().includes(q) ||
        assetFor(item.assetKind).label.toLowerCase().includes(q),
      );
    }
    return [...next].sort((a, b) => {
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (a.payment !== b.payment) return a.payment.localeCompare(b.payment);
      const av = BigInt(a.budgetAtomic);
      const bv = BigInt(b.budgetAtomic);
      if (av === bv) return 0;
      return sort === "price-low" ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });
  }, [assetFilter, paymentFilter, query, requests, sort]);

  async function refreshRequests() {
    clearMarketplaceRequestCache();
    const rows = await readMarketplaceRequests(true);
    setRequests(rows);
  }

  async function postWantedRequest() {
    if (!address || requestState === "signing" || requestState === "saving") return;
    const payment = paymentFor(requestPayment);
    if (!/^\d+(\.\d+)?$/.test(requestBudget.trim())) {
      setRequestState("error");
      setRequestMessage("Enter a budget greater than zero.");
      return;
    }

    let budgetAtomic: bigint;
    try {
      budgetAtomic = parseUnits(requestBudget.trim(), payment.decimals);
    } catch {
      setRequestState("error");
      setRequestMessage("That budget is not valid.");
      return;
    }
    if (budgetAtomic <= 0n) {
      setRequestState("error");
      setRequestMessage("Enter a budget greater than zero.");
      return;
    }

    const quantity = requestAsset === "seed" ? requestDetail.replace(/\D/g, "") : "1";
    const tokenId = requestAsset === "seed" ? "" : requestDetail.replace(/\D/g, "");
    if (requestAsset === "seed" && (!quantity || BigInt(quantity) <= 0n)) {
      setRequestState("error");
      setRequestMessage("Enter how many SEED you want.");
      return;
    }

    const expiresAt = defaultExpiry();
    const timestamp = Date.now();
    const nonce = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${timestamp}-${Math.random().toString(36).slice(2)}`;
    const note = requestNote.trim().slice(0, 140);

    try {
      setRequestState("signing");
      setRequestMessage("Sign once to publish your wanted request. No funds are locked.");
      const message = marketplaceRequestMessage({
        requester: address,
        assetKind: requestAsset,
        tokenId,
        quantity,
        payment: requestPayment,
        budgetAtomic: budgetAtomic.toString(),
        note,
        expiresAt,
        nonce,
        timestamp,
      });
      const signature = await signMessageAsync({ message });

      setRequestState("saving");
      const response = await fetch("/api/market/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          requester: address,
          assetKind: requestAsset,
          tokenId,
          quantity,
          payment: requestPayment,
          budget: requestBudget.trim(),
          note,
          expiresAt,
          nonce,
          timestamp,
          signature,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.ok) throw new Error(body?.error || "Could not publish request.");

      setRequestState("success");
      setRequestMessage("Wanted request posted for 7 days.");
      setRequestBudget("");
      setRequestNote("");
      await refreshRequests();
    } catch (error: any) {
      setRequestState("error");
      setRequestMessage(error?.shortMessage || error?.message || "Request was not posted.");
    }
  }

  async function cancelWantedRequest(item: MarketplaceRequest) {
    if (!address || address.toLowerCase() !== item.requester.toLowerCase()) return;
    try {
      const timestamp = Date.now();
      setRequestState("signing");
      setRequestMessage("Sign to remove your wanted request.");
      const signature = await signMessageAsync({
        message: marketplaceRequestCancelMessage({ requester: address, requestId: item.id, timestamp }),
      });
      setRequestState("saving");
      const response = await fetch("/api/market/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", requester: address, requestId: item.id, timestamp, signature }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.ok) throw new Error(body?.error || "Could not cancel request.");
      setRequestState("success");
      setRequestMessage("Request removed.");
      await refreshRequests();
    } catch (error: any) {
      setRequestState("error");
      setRequestMessage(error?.shortMessage || error?.message || "Request was not removed.");
    }
  }

  return (
    <div className="marketplace-stack">
      <section className="market-mode-switch" aria-label="Market view">
        <button type="button" className={marketView === "sale" ? "is-active" : ""} onClick={() => setMarketView("sale")}>
          <span>FOR SALE</span><strong>Browse listings</strong><small>Assets looking for a buyer</small>
        </button>
        <button type="button" className={marketView === "wanted" ? "is-active" : ""} onClick={() => setMarketView("wanted")}>
          <span>WANTED</span><strong>Browse requests</strong><small>Frogs looking for an asset</small>
        </button>
      </section>

      <section className="market-assets-overview" aria-label="Marketplace assets">
        {MARKETPLACE_ASSETS.map((asset) => (
          <button
            key={asset.id}
            type="button"
            className={`market-asset-choice ${selectedAsset === asset.id ? "is-selected" : ""}`}
            onClick={() => {
              setSelectedAsset(asset.id);
              setRequestAsset(asset.id);
              setAssetFilter(asset.id);
            }}
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

      {marketView === "sale" ? (
        <section className="market-compose-card market-compose-card-v2">
          <div className="market-compose-head">
            <div className="market-compose-copy">
              <span>SELL AN ASSET</span>
              <h2>Simple listing setup.</h2>
              <p>Choose what you are selling, what you want to receive, and your total price.</p>
            </div>
            <span className="market-fee-badge"><b>{MARKETPLACE_FEE_PERCENT}%</b><small>market fee</small></span>
          </div>

          <div className="market-listing-steps">
            <label><span><i>1</i> ASSET</span><select value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value as MarketplaceAssetKind)}>{MARKETPLACE_ASSETS.map((asset) => <option key={asset.id} value={asset.id}>{asset.label}</option>)}</select></label>
            <label><span><i>2</i> {chosenAsset.quantityBased ? "QUANTITY" : "DEED ID"}</span><input inputMode="numeric" value={assetDetail} onChange={(e) => setAssetDetail(e.target.value.replace(/[^0-9]/g, ""))} placeholder={chosenAsset.quantityBased ? "SEED amount" : "Token ID"} /></label>
            <label><span><i>3</i> GET PAID IN</span><select value={selectedPayment} onChange={(e) => setSelectedPayment(e.target.value as MarketplacePayment)}>{MARKETPLACE_PAYMENTS.map((payment) => <option key={payment.id} value={payment.id}>{payment.label}</option>)}</select></label>
            <label><span>PRICE</span><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={`0 ${selectedPayment}`} /></label>
          </div>

          <div className="market-listing-summary">
            <div><small>YOU HOLD</small><strong>{heldByKind[selectedAsset].toLocaleString()} {chosenAsset.shortLabel}</strong></div>
            <div><small>MARKET FEE</small><strong>{validPrice ? `${feePreview.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${selectedPayment}` : `${MARKETPLACE_FEE_PERCENT}%`}</strong></div>
            <div><small>YOU RECEIVE</small><strong>{validPrice ? `${receivePreview.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${selectedPayment}` : "—"}</strong></div>
          </div>

          <button type="button" className="market-list-button" disabled>
            <span>{isConnected ? "Onchain listing opens when the Tobyworld market contract is connected" : "Connect a wallet to prepare a listing"}</span>
            <b>SOON</b>
          </button>
        </section>
      ) : (
        <section className="market-compose-card market-request-compose">
          <div className="market-compose-head">
            <div className="market-compose-copy">
              <span>POST A WANTED REQUEST</span>
              <h2>Tell the pond what you are looking for.</h2>
              <p>A wanted request is public intent only. It does not lock funds or create an onchain bid.</p>
            </div>
            <span className="market-request-badge"><b>7 DAYS</b><small>request life</small></span>
          </div>

          <div className="market-listing-steps market-request-steps">
            <label><span><i>1</i> I WANT</span><select value={requestAsset} onChange={(e) => setRequestAsset(e.target.value as MarketplaceAssetKind)}>{MARKETPLACE_ASSETS.map((asset) => <option key={asset.id} value={asset.id}>{asset.label}</option>)}</select></label>
            <label><span><i>2</i> {requestChosenAsset.quantityBased ? "QUANTITY" : "DEED ID · OPTIONAL"}</span><input inputMode="numeric" value={requestDetail} onChange={(e) => setRequestDetail(e.target.value.replace(/[^0-9]/g, ""))} placeholder={requestChosenAsset.quantityBased ? "SEED amount" : "Any deed"} /></label>
            <label><span><i>3</i> I CAN PAY</span><select value={requestPayment} onChange={(e) => setRequestPayment(e.target.value as MarketplacePayment)}>{MARKETPLACE_PAYMENTS.map((payment) => <option key={payment.id} value={payment.id}>{payment.label}</option>)}</select></label>
            <label><span>MAX BUDGET</span><input inputMode="decimal" value={requestBudget} onChange={(e) => setRequestBudget(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={`0 ${requestPayment}`} /></label>
          </div>
          <label className="market-request-note"><span>OPTIONAL NOTE</span><input value={requestNote} maxLength={140} onChange={(e) => setRequestNote(e.target.value)} placeholder="Example: looking for a low deed number" /></label>

          <button type="button" className="market-request-button" onClick={postWantedRequest} disabled={!isConnected || requestState === "signing" || requestState === "saving"}>
            <span>{!isConnected ? "Connect wallet to post" : requestState === "signing" ? "Waiting for signature…" : requestState === "saving" ? "Posting request…" : "Post wanted request"}</span><b>WANTED</b>
          </button>
          {requestMessage && <div className={`market-request-message ${requestState === "error" ? "is-error" : requestState === "success" ? "is-success" : ""}`}>{requestMessage}</div>}
        </section>
      )}

      <section className="market-listings-card">
        <div className="market-listings-head">
          <div>
            <span>{marketView === "sale" ? "MARKETPLACE" : "WANTED BOARD"}</span>
            <h2>{marketView === "sale" ? "Browse listings" : "What frogs are looking for"}</h2>
            <p>{marketView === "sale" ? "SEED, Old Lore Land, and Canonical Lore Land in one market." : "Public requests help sellers see demand before they list."}</p>
          </div>
          <span className="exchange-status">{marketView === "wanted" ? "OPEN" : LAND_EXCHANGE_ENABLED ? "LIVE" : "PREVIEW"}</span>
        </div>

        <div className="market-quick-filters" aria-label="Asset filters">
          <button type="button" className={assetFilter === "all" ? "is-active" : ""} onClick={() => setAssetFilter("all")}>All</button>
          {MARKETPLACE_ASSETS.map((asset) => <button key={asset.id} type="button" className={assetFilter === asset.id ? "is-active" : ""} onClick={() => setAssetFilter(asset.id)}>{asset.shortLabel}</button>)}
        </div>

        <div className="market-filterbar">
          <label className="market-search"><span>SEARCH</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={marketView === "sale" ? "Deed #, seller, asset…" : "Deed #, requester, note…"} /></label>
          <label><span>PAYMENT</span><select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}><option value="all">Any token</option>{MARKETPLACE_PAYMENTS.map((payment) => <option key={payment.id} value={payment.id}>{payment.label}</option>)}</select></label>
          <label><span>SORT</span><select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}><option value="newest">Newest</option><option value="price-low">Price: low</option><option value="price-high">Price: high</option></select></label>
        </div>

        {marketView === "sale" ? (
          visibleListings.length === 0 ? (
            <div className="market-empty-clean">
              <div className="market-empty-stack"><AssetVisual kind="seed" /><AssetVisual kind="old-land" /><AssetVisual kind="lore-land" /></div>
              <h3>The shelves are ready.</h3>
              <p>No live listings yet. The market UI is ready for the settlement contract.</p>
              <div><button type="button" onClick={() => setMarketView("wanted")}>See wanted requests</button><a href="/taboshi1#pouch">Open My Tobyworld</a></div>
            </div>
          ) : (
            <div className="market-grid">
              {visibleListings.map((listing) => (
                <article key={listing.listingId} className="market-listing-tile">
                  <AssetVisual kind={listing.assetKind} />
                  <div className="market-listing-tile-copy"><small>{assetFor(listing.assetKind).shortLabel}</small><h3>{listing.assetKind === "seed" ? `${listing.quantity || "—"} SEED` : `Deed #${listing.tokenId || "—"}`}</h3><p>{shortAddress(listing.seller)}</p></div>
                  <div className="market-listing-tile-price"><small>PRICE</small><strong>{displayListingPrice(listing)}</strong></div>
                  <button type="button" disabled>View listing</button>
                </article>
              ))}
            </div>
          )
        ) : visibleRequests.length === 0 ? (
          <div className="market-empty-clean market-wanted-empty">
            <div className="market-empty-stack"><AssetVisual kind="seed" /><AssetVisual kind="old-land" /><AssetVisual kind="lore-land" /></div>
            <h3>No requests here yet.</h3>
            <p>Post what you are looking for and give potential sellers a clear signal.</p>
          </div>
        ) : (
          <div className="market-grid market-request-grid">
            {visibleRequests.map((item) => {
              const mine = Boolean(address && address.toLowerCase() === item.requester.toLowerCase());
              return (
                <article key={item.id} className="market-listing-tile market-request-tile">
                  <AssetVisual kind={item.assetKind} />
                  <div className="market-listing-tile-copy">
                    <small>WANTED · {assetFor(item.assetKind).shortLabel}</small>
                    <h3>{item.assetKind === "seed" ? `${item.quantity || "—"} SEED` : item.tokenId ? `Deed #${item.tokenId}` : "Any deed"}</h3>
                    <p>{mine ? "Your request" : shortAddress(item.requester)}</p>
                    {item.note && <em>{item.note}</em>}
                  </div>
                  <div className="market-listing-tile-price"><small>UP TO</small><strong>{displayRequestBudget(item)}</strong></div>
                  {mine ? <button type="button" className="market-request-cancel" onClick={() => cancelWantedRequest(item)} disabled={requestState === "signing" || requestState === "saving"}>Remove request</button> : <span className="market-request-intent">PUBLIC REQUEST · NO FUNDS LOCKED</span>}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="market-rules-strip">
        <span><b>BASE</b><small>Network</small></span>
        <span><b>USDC · ETH · TOBY</b><small>Payment choices</small></span>
        <span><b>{MARKETPLACE_FEE_PERCENT}%</b><small>Sale fee · requests are free</small></span>
      </section>
    </div>
  );
}
