"use client";

import { useMemo, useState } from "react";
import { erc20Abi, type Address } from "viem";
import { base } from "viem/chains";
import { useBalance, useReadContracts } from "wagmi";
import { CBBTC, PATIENCE, TABOSHI, TOBY } from "@/lib/addresses";
import { LORE_COLLECTION_ADDRESS, OLD_LORE_COLLECTION_ADDRESS } from "@/lib/lore-deeds";
import { useUsdPrices } from "@/lib/prices";
import { buildFarcasterComposeUrl, composeCast, openInMini, SITE_URL } from "@/lib/miniapps";
import {
  LORE_ACTIVATION_MANAGER,
  LORE_ACTIVATION_VAULT,
  LORE_RESERVE_CUSTODY,
  PATIENCE_FEE_TREASURY,
  POND_LORE_RESERVE,
  RESERVE_MANAGER_ABI,
  RESERVE_VAULT_ABI,
  SYSTEM_ROLES,
  TOBYWORLD_GOVERNANCE_SAFE,
  reserveBaseScan,
} from "@/lib/pond-reserves";

const readQuery = {
  staleTime: 60_000,
  refetchInterval: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

function valueAt(rows: readonly any[] | undefined, index: number) {
  const row = rows?.[index];
  return row?.status === "success" && typeof row.result === "bigint" ? row.result as bigint : undefined;
}

function units(value?: bigint, decimals = 18, maximumFractionDigits = 2) {
  if (value === undefined) return "…";
  const n = Number(value) / 10 ** decimals;
  if (!Number.isFinite(n)) return "…";
  return n.toLocaleString(undefined, { maximumFractionDigits });
}

function compact(value?: bigint, decimals = 18) {
  if (value === undefined) return "…";
  const n = Number(value) / 10 ** decimals;
  if (!Number.isFinite(n)) return "…";
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function usd(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return "…";
  if (value === 0) return "$0";
  if (value < 0.01) return "<$0.01";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: value >= 1_000 ? 0 : 2 });
}

function fiat(raw: bigint | undefined, decimals: number, price?: number) {
  if (raw === undefined || !price) return undefined;
  return (Number(raw) / 10 ** decimals) * price;
}

function short(address: Address) { return `${address.slice(0, 6)}…${address.slice(-4)}`; }

export default function PondReserves(props: {
  seedTreasury: Address;
  seedCbBtc?: bigint;
  seedCbBtcUsd?: number;
}) {
  const [sharing, setSharing] = useState<"cast" | "copy" | null>(null);
  const contracts = useMemo(() => [
    { address: PATIENCE, abi: erc20Abi, functionName: "balanceOf", args: [PATIENCE_FEE_TREASURY], chainId: base.id },
    { address: PATIENCE, abi: erc20Abi, functionName: "balanceOf", args: [LORE_ACTIVATION_VAULT], chainId: base.id },
    { address: LORE_ACTIVATION_VAULT, abi: RESERVE_VAULT_ABI, functionName: "totalActuallyReceived", chainId: base.id },
    { address: LORE_ACTIVATION_VAULT, abi: RESERVE_VAULT_ABI, functionName: "totalActivationsCollected", chainId: base.id },
    { address: PATIENCE, abi: erc20Abi, functionName: "balanceOf", args: [POND_LORE_RESERVE], chainId: base.id },
    { address: LORE_COLLECTION_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [POND_LORE_RESERVE], chainId: base.id },
    { address: OLD_LORE_COLLECTION_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [POND_LORE_RESERVE], chainId: base.id },
    { address: LORE_COLLECTION_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [LORE_RESERVE_CUSTODY], chainId: base.id },
    { address: LORE_ACTIVATION_MANAGER, abi: RESERVE_MANAGER_ABI, functionName: "totalLockedX", chainId: base.id },
    { address: LORE_ACTIVATION_MANAGER, abi: RESERVE_MANAGER_ABI, functionName: "totalActivations", chainId: base.id },
    { address: PATIENCE, abi: erc20Abi, functionName: "balanceOf", args: [TOBYWORLD_GOVERNANCE_SAFE], chainId: base.id },
    { address: TOBY, abi: erc20Abi, functionName: "balanceOf", args: [TOBYWORLD_GOVERNANCE_SAFE], chainId: base.id },
    { address: TABOSHI, abi: erc20Abi, functionName: "balanceOf", args: [TOBYWORLD_GOVERNANCE_SAFE], chainId: base.id },
    { address: CBBTC, abi: erc20Abi, functionName: "balanceOf", args: [TOBYWORLD_GOVERNANCE_SAFE], chainId: base.id },
  ] as const, []);

  const reads = useReadContracts({ contracts: contracts as any, allowFailure: true, query: readQuery });
  const pondEthRead = useBalance({ address: POND_LORE_RESERVE, chainId: base.id, query: readQuery });
  const { prices } = useUsdPrices([PATIENCE, TOBY, TABOSHI, CBBTC, "ETH"]);

  const patiencePrice = prices[PATIENCE.toLowerCase()];
  const tobyPrice = prices[TOBY.toLowerCase()];
  const taboshiPrice = prices[TABOSHI.toLowerCase()];
  const cbBtcPrice = prices[CBBTC.toLowerCase()];
  const ethPrice = prices.ETH;

  const feePatience = valueAt(reads.data, 0);
  const activationPatience = valueAt(reads.data, 1);
  const activationPatienceCollected = valueAt(reads.data, 2);
  const activationCount = valueAt(reads.data, 3);
  const pondPatience = valueAt(reads.data, 4);
  const pondLore = valueAt(reads.data, 5);
  const pondOldLore = valueAt(reads.data, 6);
  const reserveLore = valueAt(reads.data, 7);
  const lockedToby = valueAt(reads.data, 8);
  const totalActivations = valueAt(reads.data, 9);
  const safePatience = valueAt(reads.data, 10);
  const safeToby = valueAt(reads.data, 11);
  const safeTaboshi = valueAt(reads.data, 12);
  const safeCbBtc = valueAt(reads.data, 13);
  const pondEth = pondEthRead.data?.value;

  const feePatienceUsd = fiat(feePatience, 18, patiencePrice);
  const activationPatienceUsd = fiat(activationPatience, 18, patiencePrice);
  const pondPatienceUsd = fiat(pondPatience, 18, patiencePrice);
  const pondEthUsd = fiat(pondEth, 18, ethPrice);
  const lockedTobyUsd = fiat(lockedToby, 18, tobyPrice);
  const reservesUsd = feePatienceUsd === undefined || activationPatienceUsd === undefined || props.seedCbBtcUsd === undefined
    ? undefined
    : feePatienceUsd + activationPatienceUsd + props.seedCbBtcUsd;
  const liquidityUsd = pondPatienceUsd === undefined ? undefined : pondPatienceUsd + (pondEthUsd ?? 0);
  const pondLoreTotal = pondLore === undefined || pondOldLore === undefined ? undefined : pondLore + pondOldLore;

  const safeAssets = [
    { symbol: "PATIENCE", raw: safePatience, decimals: 18, price: patiencePrice },
    { symbol: "TOBY", raw: safeToby, decimals: 18, price: tobyPrice },
    { symbol: "TABOSHI", raw: safeTaboshi, decimals: 18, price: taboshiPrice },
    { symbol: "cbBTC", raw: safeCbBtc, decimals: 8, price: cbBtcPrice },
  ].filter((asset) => asset.raw !== undefined && asset.raw > 0n);

  const shareText = useMemo(() => {
    const fee = feePatience === undefined ? "PATIENCE fee reserves are counting" : `${units(feePatience, 18, 0)} PATIENCE in the fee treasury`;
    const activation = activationPatience === undefined ? "Lore activation reserves are counting" : `${units(activationPatience)} PATIENCE held from ${activationCount?.toLocaleString() ?? "…"} Lore activations`;
    const pond = pondPatience === undefined ? "Pond liquidity is counting" : `${units(pondPatience)} PATIENCE in the Pond reserve`;
    const committed = lockedToby === undefined ? "committed TOBY is counting" : `${compact(lockedToby)} TOBY committed`;
    const deeds = reserveLore === undefined ? "Lore reserve is counting" : `${reserveLore.toLocaleString()} canonical Lore Deeds in reserve`;
    const btc = props.seedCbBtc === undefined ? "the SEED reserve is counting" : `${units(props.seedCbBtc, 8, 8)} cbBTC in the SEED reserve`;
    return `The Pond Reserves · live on Base 🌊\n\n🔺 ${fee}\n🌎 ${activation}\n🌊 ${pond}\n🐸 ${committed}\n📜 ${deeds}\n₿ ${btc}\n\nReserves, liquidity and committed value—counted separately.`;
  }, [activationCount, activationPatience, feePatience, lockedToby, pondPatience, props.seedCbBtc, reserveLore]);

  async function cast() {
    setSharing("cast");
    try {
      const page = `${SITE_URL.replace(/\/$/, "")}#pond-reserves`;
      if (await composeCast({ text: shareText, embeds: [page] })) return;
      const url = buildFarcasterComposeUrl({ text: shareText, embeds: [page] });
      if (!(await openInMini(url))) window.open(url, "_blank", "noopener,noreferrer");
    } finally { setSharing(null); }
  }

  function postOnX() {
    const page = `${SITE_URL.replace(/\/$/, "")}#pond-reserves`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(page)}`, "_blank", "noopener,noreferrer");
  }

  async function copy() {
    setSharing("copy");
    try { await navigator.clipboard.writeText(shareText); window.setTimeout(() => setSharing(null), 1400); }
    catch { setSharing(null); }
  }

  return <section id="pond-reserves" className="pond-reserves" aria-labelledby="pond-reserves-title">
    <div className="pond-reserves-glow" aria-hidden="true" />
    <header className="pond-reserves-head">
      <div><span>LIVE ACCOUNTING · BASE</span><h3 id="pond-reserves-title">The Pond Reserves</h3><p>What the protocol holds, what the Pond uses, and what Keepers have committed—without counting the same value twice.</p></div>
      <div className="pond-reserves-total"><small>RESERVE VALUE</small><strong>{usd(reservesUsd)}</strong><em>Spendable reserve assets only</em></div>
    </header>

    <div className="pond-reserve-summary" aria-label="Reserve accounting categories">
      <article className="is-reserve"><span>RESERVES</span><strong>{usd(reservesUsd)}</strong><small>PATIENCE treasuries + SEED cbBTC</small></article>
      <article className="is-liquidity"><span>POND LIQUIDITY</span><strong>{usd(liquidityUsd)}</strong><small>Market-held PATIENCE + ETH</small></article>
      <article className="is-committed"><span>TOBY COMMITTED</span><strong>{usd(lockedTobyUsd)}</strong><small>{compact(lockedToby)} TOBY locked</small></article>
      <article className="is-deeds"><span>LORE RESERVE</span><strong>{reserveLore?.toLocaleString() ?? "…"}</strong><small>Canonical deeds held for release</small></article>
    </div>

    <div className="pond-reserve-cards">
      <article className="pond-reserve-card is-fee">
        <div className="pond-reserve-card-icon">🔺</div><div className="pond-reserve-card-copy"><span>PATIENCE FEE TREASURY</span><strong>{units(feePatience, 18, 2)} PATIENCE</strong><em>{usd(feePatienceUsd)}</em><small>Collected from the token&apos;s 1% transfer fee.</small></div>
        <a href={reserveBaseScan(PATIENCE_FEE_TREASURY)} target="_blank" rel="noreferrer" title={PATIENCE_FEE_TREASURY}>{short(PATIENCE_FEE_TREASURY)} ↗</a>
      </article>
      <article className="pond-reserve-card is-activation">
        <div className="pond-reserve-card-icon">🌎</div><div className="pond-reserve-card-copy"><span>LORE ACTIVATION VAULT</span><strong>{units(activationPatience)} PATIENCE</strong><em>{usd(activationPatienceUsd)}</em><small>{activationPatienceCollected === undefined ? "Reading cumulative receipts…" : `${units(activationPatienceCollected)} PATIENCE received across ${activationCount?.toLocaleString() ?? "…"} activations.`}</small></div>
        <a href={reserveBaseScan(LORE_ACTIVATION_VAULT)} target="_blank" rel="noreferrer" title={LORE_ACTIVATION_VAULT}>{short(LORE_ACTIVATION_VAULT)} ↗</a>
      </article>
      <article className="pond-reserve-card is-pond">
        <div className="pond-reserve-card-icon">🌊</div><div className="pond-reserve-card-copy"><span>POND / LORE AMM RESERVE</span><strong>{units(pondPatience)} PATIENCE</strong><em>{usd(pondPatienceUsd)}</em><small>{pondEth && pondEth > 0n ? `${units(pondEth, 18, 4)} ETH · ${usd(pondEthUsd)}` : "No native ETH currently held"}{pondLoreTotal && pondLoreTotal > 0n ? ` · ${pondLoreTotal.toLocaleString()} Lore Deeds` : ""}</small></div>
        <a href={reserveBaseScan(POND_LORE_RESERVE)} target="_blank" rel="noreferrer" title={POND_LORE_RESERVE}>{short(POND_LORE_RESERVE)} ↗</a>
      </article>
      <article className="pond-reserve-card is-toby">
        <div className="pond-reserve-card-icon">🐸</div><div className="pond-reserve-card-copy"><span>LORE ACTIVATION TOBY LOCK</span><strong>{compact(lockedToby)} TOBY</strong><em>{usd(lockedTobyUsd)}</em><small>Currently committed across {totalActivations?.toLocaleString() ?? "…"} Lore activations. Not spendable treasury value.</small></div>
        <a href={reserveBaseScan(LORE_ACTIVATION_MANAGER)} target="_blank" rel="noreferrer" title={LORE_ACTIVATION_MANAGER}>{short(LORE_ACTIVATION_MANAGER)} ↗</a>
      </article>
      <article className="pond-reserve-card is-lore">
        <div className="pond-reserve-card-icon">📜</div><div className="pond-reserve-card-copy"><span>LORE RESERVE CUSTODY</span><strong>{reserveLore?.toLocaleString() ?? "…"} DEEDS</strong><em>Protocol-controlled inventory</em><small>Canonical Lore reserve awaiting controlled release into the Pond.</small></div>
        <a href={reserveBaseScan(LORE_RESERVE_CUSTODY)} target="_blank" rel="noreferrer" title={LORE_RESERVE_CUSTODY}>{short(LORE_RESERVE_CUSTODY)} ↗</a>
      </article>
      <article className="pond-reserve-card is-bitcoin">
        <div className="pond-reserve-card-icon">₿</div><div className="pond-reserve-card-copy"><span>SEED cbBTC RESERVE</span><strong>{units(props.seedCbBtc, 8, 8)} cbBTC</strong><em>{usd(props.seedCbBtcUsd)}</em><small>Custody address is derived live from the official Faucet contract.</small></div>
        <a href={reserveBaseScan(props.seedTreasury)} target="_blank" rel="noreferrer" title={props.seedTreasury}>{short(props.seedTreasury)} ↗</a>
      </article>
    </div>

    <div className="pond-reserve-governance">
      <div><span>TOBYWORLD GOVERNANCE SAFE</span><strong>{safeAssets.length ? "Protocol assets detected" : "No counted protocol assets"}</strong><small>Shown separately and never added to reserve revenue automatically.</small></div>
      {safeAssets.length > 0 && <div className="pond-reserve-safe-assets">{safeAssets.map((asset) => <b key={asset.symbol}>{units(asset.raw, asset.decimals)} {asset.symbol} · {usd(fiat(asset.raw, asset.decimals, asset.price))}</b>)}</div>}
      <a href={reserveBaseScan(TOBYWORLD_GOVERNANCE_SAFE)} target="_blank" rel="noreferrer" title={TOBYWORLD_GOVERNANCE_SAFE}>{short(TOBYWORLD_GOVERNANCE_SAFE)} ↗</a>
    </div>

    <details className="pond-reserve-systems">
      <summary><span>System infrastructure</span><b>Excluded from reserve totals</b><i>⌄</i></summary>
      <div>{SYSTEM_ROLES.map((role) => <a href={reserveBaseScan(role.address)} target="_blank" rel="noreferrer" key={role.address}><span><strong>{role.title}</strong><small>{role.note}</small></span><b>{short(role.address)} ↗</b></a>)}</div>
    </details>

    <footer className="pond-reserve-share"><div><span>SHARE THE SNAPSHOT</span><strong>Let the onchain numbers speak.</strong></div><div><button type="button" onClick={cast} disabled={sharing === "cast"}>{sharing === "cast" ? "Opening…" : "Cast reserves"}</button><button type="button" onClick={postOnX}>Post on X</button><button type="button" onClick={copy}>{sharing === "copy" ? "Copied ✓" : "Copy"}</button></div></footer>
  </section>;
}

