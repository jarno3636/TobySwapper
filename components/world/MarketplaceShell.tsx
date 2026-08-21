"use client";

import Image from "next/image";
import LoreDeedArt from "@/components/land/LoreDeedArt";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits, zeroAddress, type Address, erc20Abi } from "viem";
import {
  useAccount, usePublicClient, useReadContracts, useSignMessage,
  useSwitchChain, useWriteContract,
} from "wagmi";
import { base } from "wagmi/chains";
import { composeCast, buildFarcasterComposeUrl, openInMini, SITE_URL } from "@/lib/miniapps";
import { TABOSHI_SEEDS_ABI, TABOSHI_SEED_ID } from "@/lib/taboshi-seeds";
import { LEGACY_LORE_DEED_ABI, LORE_DEEDS_ABI } from "@/lib/lore-deeds";
import {
  LAND_EXCHANGE_ENABLED, MARKETPLACE_ASSETS, MARKETPLACE_FEE_PERCENT,
  MARKETPLACE_PAYMENTS, type MarketplaceAssetKind, type MarketplacePayment,
  type TobyworldListing,
} from "@/lib/land-exchange";
import { clearMarketplaceListingCache, readMarketplaceListings } from "@/lib/marketplace-listings";
import {
  ERC1155_MARKET_ABI, ERC20_MARKET_ABI, ERC721_MARKET_ABI,
  MARKETPLACE_ABI, MARKETPLACE_ADDRESS,
} from "@/lib/marketplace-contract";
import {
  clearMarketplaceRequestCache, readMarketplaceRequests, requestMessage,
  type MarketplaceRequest,
} from "@/lib/marketplace-requests";

type AssetFilter = "all" | MarketplaceAssetKind;
type PaymentFilter = "all" | MarketplacePayment;
type SortMode = "newest" | "price-low" | "price-high";
type MarketMode = "sale" | "wanted";
type Notice = { kind: "success" | "error" | "info"; title: string; body: string; hash?: string; shareText?: string } | null;
type ConfirmState = { title: string; body: string; confirmLabel: string; run: () => Promise<void> } | null;

function assetFor(id: MarketplaceAssetKind) { return MARKETPLACE_ASSETS.find((asset) => asset.id === id)!; }
function paymentFor(id: MarketplacePayment) { return MARKETPLACE_PAYMENTS.find((payment) => payment.id === id)!; }
function shortAddress(value: string) { return `${value.slice(0, 6)}…${value.slice(-4)}`; }

function MarketNoticeIcon({ kind }: { kind: "success" | "error" | "info" }) {
  if (kind === "success") return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 12.5 3.1 3.1L17.6 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" opacity=".4"/></svg>;
  if (kind === "error") return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 7.2v6.1" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/><circle cx="12" cy="16.9" r="1.25" fill="currentColor"/><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" opacity=".4"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 4.5 7 13H5l7-13Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="15.4" r=".9" fill="currentColor"/></svg>;
}

function AssetVisual({ kind }: { kind: MarketplaceAssetKind }) {
  if (kind === "seed") return <span className="market-asset-art is-seed"><Image src="/ui/seed.webp" alt="" fill sizes="62px" className="object-cover" /></span>;
  return <span className={`market-asset-art ${kind === "old-land" ? "is-old-land" : "is-lore-land"}`}><b>△</b><i /></span>;
}

function displayAtomic(amount: string, payment: MarketplacePayment) {
  try {
    const token = paymentFor(payment);
    const value = formatUnits(BigInt(amount), token.decimals);
    const [whole, fraction = ""] = value.split(".");
    const trimmed = fraction.slice(0, payment === "USDC" ? 2 : 6).replace(/0+$/, "");
    return `${whole}${trimmed ? `.${trimmed}` : ""} ${token.label}`;
  } catch { return `— ${payment}`; }
}

function friendlyError(error: any) {
  const raw = String(error?.shortMessage || error?.message || error || "Transaction failed");
  if (/user rejected|denied|cancelled/i.test(raw)) return "You cancelled the wallet request. Nothing changed.";
  if (/MarketplaceNotApproved|NotApproved/i.test(raw)) return "The market still needs permission for this asset. Approve it and try again.";
  if (/AssetNotOwned|NotOwner/i.test(raw)) return "This wallet no longer owns that asset.";
  if (/InsufficientSeeds/i.test(raw)) return "That SEED amount is larger than the amount currently available to list.";
  if (/ERC721AlreadyListed/i.test(raw)) return "That deed already has an active listing. Cancel or update the existing listing first.";
  if (/ListingExpired/i.test(raw)) return "That listing has expired.";
  if (/ListingTermsChanged/i.test(raw)) return "The seller changed the price or payment token before your purchase landed. Review the new terms first.";
  if (/ListingNotActive|InvalidListing/i.test(raw)) return "That listing is no longer active.";
  if (/insufficient funds/i.test(raw)) return "The wallet does not have enough funds for this transaction and gas.";
  if (/allowance|SafeERC20/i.test(raw)) return "The payment token still needs enough allowance for this purchase.";
  return raw.length > 180 ? "The transaction could not complete. No completed trade was recorded." : raw;
}

export default function MarketplaceShell() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: base.id });
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();

  const holdingReads = useReadContracts({
    contracts: address ? [
      { address: MARKETPLACE_ASSETS[0].address, abi: TABOSHI_SEEDS_ABI, functionName: "balanceOf", args: [address, TABOSHI_SEED_ID], chainId: base.id },
      { address: MARKETPLACE_ASSETS[1].address, abi: LEGACY_LORE_DEED_ABI, functionName: "balanceOf", args: [address], chainId: base.id },
      { address: MARKETPLACE_ASSETS[2].address, abi: LORE_DEEDS_ABI, functionName: "balanceOf", args: [address], chainId: base.id },
    ] as const : [],
    query: { enabled: Boolean(address), staleTime: 20_000, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: true, refetchOnMount: "always" },
  });

  const heldByKind: Record<MarketplaceAssetKind, bigint> = {
    seed: typeof holdingReads.data?.[0]?.result === "bigint" ? holdingReads.data[0].result : 0n,
    "old-land": typeof holdingReads.data?.[1]?.result === "bigint" ? holdingReads.data[1].result : 0n,
    "lore-land": typeof holdingReads.data?.[2]?.result === "bigint" ? holdingReads.data[2].result : 0n,
  };

  const [mode, setMode] = useState<MarketMode>("sale");
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
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [showHistory, setShowHistory] = useState(false);

  async function reload(force = false) {
    const [marketRows, wantedRows] = await Promise.all([
      readMarketplaceListings(force), readMarketplaceRequests(force),
    ]);
    setListings(marketRows);
    setRequests(wantedRows);
  }

  useEffect(() => { void reload(); }, []);
  useEffect(() => { setAssetDetail("1"); }, [selectedAsset]);

  const chosenAsset = assetFor(selectedAsset);
  const numericPrice = Number(price);
  const validPrice = Number.isFinite(numericPrice) && numericPrice > 0;
  const feePreview = validPrice ? numericPrice * (MARKETPLACE_FEE_PERCENT / 100) : 0;
  const receivePreview = validPrice ? numericPrice - feePreview : 0;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let next = listings.filter((listing) =>
      (showHistory || listing.status === "active") &&
      (assetFilter === "all" || listing.assetKind === assetFilter) &&
      (paymentFilter === "all" || listing.payment === paymentFilter),
    );
    if (q) next = next.filter((listing) => listing.listingId.includes(q) || listing.tokenId?.includes(q) || listing.seller.toLowerCase().includes(q) || assetFor(listing.assetKind).label.toLowerCase().includes(q));
    return [...next].sort((a, b) => {
      if (sort === "newest") return Number(b.listingId) - Number(a.listingId);
      if (a.payment !== b.payment) return a.payment.localeCompare(b.payment);
      const av = BigInt(a.priceAtomic), bv = BigInt(b.priceAtomic);
      if (av === bv) return 0;
      return sort === "price-low" ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });
  }, [assetFilter, listings, paymentFilter, query, showHistory, sort]);

  const visibleRequests = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((row) => row.status === "active" && (assetFilter === "all" || row.assetKind === assetFilter) && (paymentFilter === "all" || row.payment === paymentFilter) && (!q || row.tokenId?.includes(q) || row.requester.toLowerCase().includes(q) || row.note?.toLowerCase().includes(q) || assetFor(row.assetKind).label.toLowerCase().includes(q)));
  }, [assetFilter, paymentFilter, query, requests]);

  async function ensureBase() { if (chainId !== base.id) await switchChainAsync({ chainId: base.id }); }
  async function wait(hash: `0x${string}`) { if (publicClient) await publicClient.waitForTransactionReceipt({ hash }); }

  async function ensureAssetApproval(assetKind: MarketplaceAssetKind, tokenId: bigint) {
    if (!address || !publicClient) throw new Error("Connect your wallet first.");
    await ensureBase();
    const asset = assetFor(assetKind);
    if (assetKind === "seed") {
      const approved = await publicClient.readContract({ address: asset.address, abi: ERC1155_MARKET_ABI, functionName: "isApprovedForAll", args: [address, MARKETPLACE_ADDRESS] });
      if (!approved) {
        setBusy("approving");
        const hash = await writeContractAsync({ address: asset.address, abi: ERC1155_MARKET_ABI, functionName: "setApprovalForAll", args: [MARKETPLACE_ADDRESS, true], chainId: base.id });
        await wait(hash);
      }
    } else {
      // One collection-level approval replaces a fresh approval transaction for
      // every deed listing. The marketplace still moves only assets covered by a
      // live listing, while future listings become a single wallet confirmation.
      const approvedForAll = await publicClient.readContract({
        address: asset.address,
        abi: ERC721_MARKET_ABI,
        functionName: "isApprovedForAll",
        args: [address, MARKETPLACE_ADDRESS],
      });
      if (!approvedForAll) {
        setBusy("approving");
        const hash = await writeContractAsync({
          address: asset.address,
          abi: ERC721_MARKET_ABI,
          functionName: "setApprovalForAll",
          args: [MARKETPLACE_ADDRESS, true],
          chainId: base.id,
        });
        await wait(hash);
      }
    }
  }

  async function createListing() {
    if (!address) return setNotice({ kind: "info", title: "Connect your wallet", body: "Connect the wallet holding the asset you want to list." });
    const payment = paymentFor(selectedPayment);
    const detail = BigInt(assetDetail || "0");
    if (!validPrice || detail <= 0n) return setNotice({ kind: "info", title: "Finish the listing", body: `Enter a valid ${chosenAsset.quantityBased ? "SEED quantity" : "deed ID"} and total price.` });
    if (selectedAsset === "seed" && detail > heldByKind.seed) return setNotice({ kind: "error", title: "Not enough SEED", body: "Reduce the quantity to an amount held by this wallet." });
    try {
      await ensureBase();
      setBusy("checking");
      const tokenId = selectedAsset === "seed" ? 1n : detail;
      const quantity = selectedAsset === "seed" ? detail : 1n;
      await ensureAssetApproval(selectedAsset, tokenId);
      setBusy("listing");
      const atomicPrice = parseUnits(price, payment.decimals);
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: "createListing",
        args: [MARKETPLACE_ASSETS.findIndex((a) => a.id === selectedAsset), tokenId, quantity, payment.address ?? zeroAddress, atomicPrice, 0n],
        chainId: base.id,
      });
      await wait(hash);
      clearMarketplaceListingCache();
      await reload(true);
      const subject = selectedAsset === "seed" ? `${detail.toLocaleString()} SEED` : `${chosenAsset.shortLabel} #${detail}`;
      setNotice({ kind: "success", title: "Listing is live", body: `${subject} is now listed for ${price} ${selectedPayment}.`, hash, shareText: `🐸 New Tobyworld market listing\n\n${subject} · ${price} ${selectedPayment}\n\nBrowse the pond market:` });
      setPrice("");
    } catch (error) {
      setNotice({ kind: "error", title: "Listing did not go live", body: friendlyError(error) });
    } finally { setBusy(""); }
  }

  async function buyListing(listing: TobyworldListing) {
    if (!address || !publicClient) return setNotice({ kind: "info", title: "Connect to buy", body: "Connect a Base wallet to purchase this listing." });
    const payment = paymentFor(listing.payment);
    const amount = BigInt(listing.priceAtomic);
    try {
      await ensureBase();
      setBusy(`buy-${listing.listingId}`);
      if (payment.address) {
        const allowance = await publicClient.readContract({ address: payment.address, abi: ERC20_MARKET_ABI, functionName: "allowance", args: [address, MARKETPLACE_ADDRESS] });
        if (allowance < amount) {
          setBusy(`approve-buy-${listing.listingId}`);
          const approveHash = await writeContractAsync({ address: payment.address, abi: ERC20_MARKET_ABI, functionName: "approve", args: [MARKETPLACE_ADDRESS, amount], chainId: base.id });
          await wait(approveHash);
        }
      }
      setBusy(`buy-${listing.listingId}`);
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: "buy",
        args: [BigInt(listing.listingId), payment.address ?? zeroAddress, amount],
        value: payment.id === "ETH" ? amount : 0n, chainId: base.id,
      });
      await wait(hash);
      clearMarketplaceListingCache();
      await reload(true);
      const subject = listing.assetKind === "seed" ? `${BigInt(listing.quantity || "0").toLocaleString()} SEED` : `${assetFor(listing.assetKind).shortLabel} #${listing.tokenId}`;
      setNotice({ kind: "success", title: "The trade crossed the pond", body: `${subject} was purchased for ${displayAtomic(listing.priceAtomic, listing.payment)}.`, hash, shareText: `🐸 Picked up ${subject} in the Tobyworld Market\n\n${displayAtomic(listing.priceAtomic, listing.payment)} on Base.\n\nSee what is moving through the pond:` });
      void holdingReads.refetch();
    } catch (error) {
      setNotice({ kind: "error", title: "Purchase did not complete", body: friendlyError(error) });
    } finally { setBusy(""); }
  }

  async function cancelListing(listing: TobyworldListing) {
    try {
      await ensureBase();
      setBusy(`cancel-${listing.listingId}`);
      const hash = await writeContractAsync({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: "cancelListing", args: [BigInt(listing.listingId)], chainId: base.id });
      await wait(hash);
      clearMarketplaceListingCache();
      await reload(true);
      setNotice({ kind: "success", title: "Listing closed", body: "The listing remains in Market History as cancelled, but it can no longer be purchased.", hash });
    } catch (error) { setNotice({ kind: "error", title: "Could not cancel listing", body: friendlyError(error) }); }
    finally { setBusy(""); }
  }

  async function postRequest() {
    if (!address) return setNotice({ kind: "info", title: "Connect to post", body: "Connect a wallet so your Wanted post can be signed." });
    const payment = paymentFor(selectedPayment);
    const detail = BigInt(assetDetail || "0");
    if (!validPrice || detail <= 0n) return setNotice({ kind: "info", title: "Finish your request", body: `Enter ${chosenAsset.quantityBased ? "the SEED amount you want" : "a deed ID, or use 0 for any deed"} and your maximum budget.` });
    try {
      setBusy("request");
      const budgetAtomic = parseUnits(price, payment.decimals).toString();
      const timestamp = Date.now();
      const tokenId = selectedAsset === "seed" ? "" : assetDetail;
      const quantity = selectedAsset === "seed" ? assetDetail : "1";
      const message = requestMessage({ requester: address, assetKind: selectedAsset, tokenId, quantity, payment: selectedPayment, budgetAtomic, note, timestamp });
      const signature = await signMessageAsync({ message });
      const response = await fetch("/api/market/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requester: address, assetKind: selectedAsset, tokenId, quantity, payment: selectedPayment, budgetAtomic, note, timestamp, signature }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Request failed");
      clearMarketplaceRequestCache();
      await reload(true);
      const subject = selectedAsset === "seed" ? `${BigInt(quantity).toLocaleString()} SEED` : `${chosenAsset.shortLabel} #${tokenId}`;
      setNotice({ kind: "success", title: "Wanted post is live", body: `${subject} · up to ${price} ${selectedPayment}. This is a public request only; no funds are locked.`, shareText: `🔎 Looking for ${subject} in Tobyworld\n\nBudget: up to ${price} ${selectedPayment}\n${note ? `${note}\n` : ""}\nKnow a frog? Send them to the market:` });
      setNote("");
    } catch (error) { setNotice({ kind: "error", title: "Wanted post was not published", body: friendlyError(error) }); }
    finally { setBusy(""); }
  }

  async function share(text?: string) {
    if (!text) return;
    const url = `${SITE_URL}/world/exchange`;
    if (await composeCast({ text, embeds: [url] })) return;
    await openInMini(buildFarcasterComposeUrl({ text, embeds: [url] }));
  }
  function shareX(text?: string) {
    if (!text || typeof window === "undefined") return;
    const url = `${SITE_URL}/world/exchange`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="marketplace-stack">
      <section className="market-mode-switch" aria-label="Market mode">
        <button className={mode === "sale" ? "is-active" : ""} onClick={() => setMode("sale")}><b>FOR SALE</b><span>Buy or list onchain</span></button>
        <button className={mode === "wanted" ? "is-active" : ""} onClick={() => setMode("wanted")}><b>WANTED</b><span>Post what you are looking for</span></button>
      </section>

      <section className="market-assets-overview" aria-label="Marketplace assets">
        {MARKETPLACE_ASSETS.map((asset) => (
          <button key={asset.id} type="button" className={`market-asset-choice ${selectedAsset === asset.id ? "is-selected" : ""}`} onClick={() => { setSelectedAsset(asset.id); setAssetFilter(asset.id); }}>
            <AssetVisual kind={asset.id} /><span><small>{asset.standard}</small><strong>{asset.shortLabel}</strong><em>{asset.note}</em><i className="market-held-line">{isConnected ? `${heldByKind[asset.id].toLocaleString()} held` : "Connect to see yours"}</i></span><b aria-hidden="true">{selectedAsset === asset.id ? "✓" : "→"}</b>
          </button>
        ))}
      </section>

      <section className={`market-compose-card market-compose-card-v2 ${mode === "wanted" ? "is-wanted" : ""}`}>
        <div className="market-compose-head"><div className="market-compose-copy"><span>{mode === "sale" ? "LIST AN ASSET" : "POST A WANTED REQUEST"}</span><h2>{mode === "sale" ? "Simple terms. Onchain settlement." : "Tell the pond what you want."}</h2><p>{mode === "sale" ? "Choose the asset and total price. Approval is requested only when needed." : "Wanted posts are public signals only. They do not lock funds or create a binding bid."}</p></div><span className="market-fee-badge"><b>{mode === "sale" ? `${MARKETPLACE_FEE_PERCENT}%` : "0"}</b><small>{mode === "sale" ? "market fee" : "funds locked"}</small></span></div>
        <div className="market-listing-steps">
          <label><span><i>1</i> ASSET</span><select value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value as MarketplaceAssetKind)}>{MARKETPLACE_ASSETS.map((asset) => <option key={asset.id} value={asset.id}>{asset.label}</option>)}</select></label>
          <label><span><i>2</i> {chosenAsset.quantityBased ? "QUANTITY" : "DEED ID"}</span><input inputMode="numeric" value={assetDetail} onChange={(e) => setAssetDetail(e.target.value.replace(/[^0-9]/g, ""))} placeholder={chosenAsset.quantityBased ? "SEED amount" : "Token ID"} /></label>
          <label><span><i>3</i> {mode === "sale" ? "GET PAID IN" : "BUDGET IN"}</span><select value={selectedPayment} onChange={(e) => setSelectedPayment(e.target.value as MarketplacePayment)}>{MARKETPLACE_PAYMENTS.map((payment) => <option key={payment.id} value={payment.id}>{payment.label}</option>)}</select></label>
          <label><span>{mode === "sale" ? "TOTAL PRICE" : "MAX BUDGET"}</span><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={`0 ${selectedPayment}`} /></label>
        </div>
        {mode === "wanted" && <label className="market-note-field"><span>OPTIONAL NOTE</span><textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 180))} placeholder="Low deed number, specific community history, open to offers…" /></label>}
        {mode === "sale" && <div className="market-listing-summary"><div><small>YOU HOLD</small><strong>{heldByKind[selectedAsset].toLocaleString()} {chosenAsset.shortLabel}</strong></div><div><small>MARKET FEE</small><strong>{validPrice ? `${feePreview.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${selectedPayment}` : `${MARKETPLACE_FEE_PERCENT}%`}</strong></div><div><small>YOU RECEIVE</small><strong>{validPrice ? `${receivePreview.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${selectedPayment}` : "—"}</strong></div></div>}
        {mode === "sale" && <div className="market-approval-note"><b>ONE-TIME MARKET PERMISSION</b><span>The first listing from an asset collection may require one approval. After that, future listings from that collection are one wallet transaction until you revoke permission.</span></div>}
        <button type="button" className="market-list-button is-live" disabled={Boolean(busy)} onClick={() => {
          if (mode === "sale") {
            setConfirm({ title: "List this asset?", body: `${selectedAsset === "seed" ? `${assetDetail || "0"} SEED` : `${chosenAsset.shortLabel} #${assetDetail || "—"}`} for ${price || "—"} ${selectedPayment}. The market charges 1% only if it sells.`, confirmLabel: "Continue to wallet", run: createListing });
          } else {
            setConfirm({ title: "Post this Wanted request?", body: `Looking for ${selectedAsset === "seed" ? `${assetDetail || "0"} SEED` : `${chosenAsset.shortLabel} #${assetDetail || "—"}`} with a budget up to ${price || "—"} ${selectedPayment}. No funds are locked.`, confirmLabel: "Sign & post", run: postRequest });
          }
        }}><span>{busy ? (busy === "approving" ? "Approve in your wallet…" : "Waiting for Base…") : !isConnected ? "Connect wallet first" : mode === "sale" ? "List on Tobyworld Market" : "Post Wanted request"}</span><b>{mode === "sale" ? "LIVE" : "SIGN"}</b></button>
      </section>

      <section className="market-listings-card">
        <div className="market-listings-head"><div><span>{mode === "sale" ? "ONCHAIN MARKET" : "WANTED BOARD"}</span><h2>{mode === "sale" ? "Browse the market" : "What frogs are looking for"}</h2><p>{mode === "sale" ? "Active trades first. Sold, cancelled, and expired listings remain in Market History." : "Public requests make it easy for holders to find interested buyers."}</p></div><span className="exchange-status">LIVE</span></div>
        <div className="market-quick-filters"><button className={assetFilter === "all" ? "is-active" : ""} onClick={() => setAssetFilter("all")}>All</button>{MARKETPLACE_ASSETS.map((asset) => <button key={asset.id} className={assetFilter === asset.id ? "is-active" : ""} onClick={() => setAssetFilter(asset.id)}>{asset.shortLabel}</button>)}</div>
        <div className="market-filterbar"><label className="market-search"><span>SEARCH</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Deed #, wallet, asset…" /></label><label><span>PAYMENT</span><select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}><option value="all">Any token</option>{MARKETPLACE_PAYMENTS.map((payment) => <option key={payment.id} value={payment.id}>{payment.label}</option>)}</select></label>{mode === "sale" && <><label><span>SORT</span><select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}><option value="newest">Newest</option><option value="price-low">Price: low</option><option value="price-high">Price: high</option></select></label><label className="market-history-toggle"><span>VIEW</span><button type="button" onClick={() => setShowHistory((v) => !v)}>{showHistory ? "Active + history" : "Active only"}</button></label></>}</div>

        {mode === "sale" ? (
          visible.length === 0 ? <div className="market-empty-clean"><div className="market-empty-stack"><AssetVisual kind="seed" /><AssetVisual kind="old-land" /><AssetVisual kind="lore-land" /></div><h3>No listings match yet.</h3><p>Change a filter or be the first frog to list something here.</p></div> :
          <div className="market-grid">{visible.map((listing) => { const asset = assetFor(listing.assetKind); const mine = address?.toLowerCase() === listing.seller.toLowerCase(); return <article key={listing.listingId} className={`market-listing-tile status-${listing.status}`}>{listing.assetKind === "lore-land" && listing.tokenId
  ? <LoreDeedArt tokenId={listing.tokenId} className="market-canonical-art" />
  : <AssetVisual kind={listing.assetKind} />}<div className="market-listing-tile-copy"><div className="market-status-line"><span className={`market-status-badge status-${listing.status}`}>{listing.status}</span><small>LISTING #{listing.listingId}</small></div><h3>{listing.assetKind === "seed" ? `${BigInt(listing.quantity || "0").toLocaleString()} SEED` : `${asset.shortLabel} #${listing.tokenId}`}</h3><p>{mine ? "Your listing" : `Seller ${shortAddress(listing.seller)}`}</p></div><div className="market-listing-tile-price"><small>TOTAL</small><strong>{displayAtomic(listing.priceAtomic, listing.payment)}</strong></div>{listing.status === "active" ? mine ? <button className="market-action secondary" disabled={Boolean(busy)} onClick={() => setConfirm({ title: "Cancel this listing?", body: "It will remain visible in Market History as cancelled, but nobody will be able to buy it.", confirmLabel: "Cancel listing", run: () => cancelListing(listing) })}>{busy === `cancel-${listing.listingId}` ? "Closing…" : "Cancel listing"}</button> : <button className="market-action primary" disabled={Boolean(busy)} onClick={() => setConfirm({ title: "Confirm purchase", body: `Buy ${listing.assetKind === "seed" ? `${BigInt(listing.quantity || "0").toLocaleString()} SEED` : `${asset.shortLabel} #${listing.tokenId}`} for ${displayAtomic(listing.priceAtomic, listing.payment)}? Your wallet will show the final transaction before it is sent.`, confirmLabel: "Continue to wallet", run: () => buyListing(listing) })}>{busy.includes(listing.listingId) ? "Open wallet…" : "Buy now"}</button> : <div className="market-history-note">{listing.status === "sold" ? "✓ Trade completed" : listing.status === "cancelled" ? "Listing cancelled" : "Listing expired"}</div>}</article>; })}</div>
        ) : (
          visibleRequests.length === 0 ? <div className="market-empty-clean"><h3>The Wanted Board is quiet.</h3><p>Post what you are hunting for and share it with the toadgang.</p></div> :
          <div className="market-grid wanted-grid">{visibleRequests.map((row) => <article key={row.id} className="market-listing-tile wanted-tile"><AssetVisual kind={row.assetKind} /><div className="market-listing-tile-copy"><div className="market-status-line"><span className="market-status-badge wanted">WANTED</span><small>{shortAddress(row.requester)}</small></div><h3>{row.assetKind === "seed" ? `${BigInt(row.quantity || "0").toLocaleString()} SEED` : row.tokenId ? `${assetFor(row.assetKind).shortLabel} #${row.tokenId}` : `Any ${assetFor(row.assetKind).shortLabel}`}</h3><p>{row.note || "Open to hearing from holders."}</p></div><div className="market-listing-tile-price"><small>UP TO</small><strong>{displayAtomic(row.budgetAtomic, row.payment)}</strong></div><button className="market-action secondary" onClick={() => share(`🔎 Tobyworld Wanted\n\nLooking for ${row.assetKind === "seed" ? `${BigInt(row.quantity || "0").toLocaleString()} SEED` : row.tokenId ? `${assetFor(row.assetKind).shortLabel} #${row.tokenId}` : assetFor(row.assetKind).shortLabel}\nBudget: up to ${displayAtomic(row.budgetAtomic, row.payment)}\n\nKnow a holder?`)}>Share request</button></article>)}</div>
        )}
      </section>

      <section className="market-rules-strip"><span><b>BASE</b><small>Network</small></span><span><b>USDC · ETH · TOBY</b><small>Payments</small></span><span><b>1%</b><small>Market fee on completed sales</small></span></section>

      {confirm && <div className="market-modal-backdrop" role="presentation" onMouseDown={() => setConfirm(null)}><section className="market-modal info market-confirm-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><div className="market-modal-mark"><MarketNoticeIcon kind="info" /></div><h2>{confirm.title}</h2><p>{confirm.body}</p><div className="market-confirm-actions"><button className="market-confirm-back" onClick={() => setConfirm(null)}>Go back</button><button className="market-confirm-go" onClick={async () => { const run = confirm.run; setConfirm(null); await run(); }}>{confirm.confirmLabel}</button></div></section></div>}

      {notice && <div className="market-modal-backdrop" role="presentation" onMouseDown={() => setNotice(null)}><section className={`market-modal ${notice.kind}`} role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><div className="market-modal-mark"><MarketNoticeIcon kind={notice.kind} /></div><h2>{notice.title}</h2><p>{notice.body}</p>{notice.hash && <a href={`https://basescan.org/tx/${notice.hash}`} target="_blank" rel="noreferrer">View on BaseScan ↗</a>}{notice.shareText && <div className="market-modal-share"><button onClick={() => share(notice.shareText)}>Cast it</button><button onClick={() => shareX(notice.shareText)}>Post to X</button></div>}<button className="market-modal-close" onClick={() => setNotice(null)}>Done</button></section></div>}
    </div>
  );
}
