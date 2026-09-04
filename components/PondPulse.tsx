"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { erc20Abi, type Address } from "viem";
import { base } from "viem/chains";
import { useBalance, useReadContract } from "wagmi";
import { TABOSHI } from "@/lib/addresses";
import { composeCast, buildFarcasterComposeUrl, openInMini, SITE_URL } from "@/lib/miniapps";
import { useUsdPriceSingle } from "@/lib/prices";
import { OPEN_FAUCET_ADDRESS, OPEN_FAUCET_ABI, deriveFaucetHistory } from "@/lib/open-faucet";
import { TABOSHI_SEEDS_ADDRESS, TABOSHI_SEEDS_ABI } from "@/lib/taboshi-seeds";
import PondReserves from "@/components/PondReserves";

const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD" as Address;
const CBBTC_BASE = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf" as Address;
const SEED_TREASURY = "0xe4A4D0235cDB57B8e7a74F2A9D1B4bCe6941f79F" as Address;
const LORE_DEEDS_PURCHASED = 2_869n;

function whole(value?: bigint) { return value === undefined ? "…" : value.toLocaleString(); }
function compactWhole(value?: bigint) {
  if (value === undefined) return "…";
  const n = Number(value);
  if (!Number.isFinite(n)) return value.toLocaleString();
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return n.toLocaleString();
}
function token18(value?: bigint) {
  if (value === undefined) return "…";
  const n = Number(value) / 1e18;
  if (!Number.isFinite(n)) return "…";
  return n.toLocaleString(undefined, { maximumFractionDigits: n >= 1000 ? 0 : 2 });
}
function ethAmount(value?: bigint) {
  if (value === undefined) return "…";
  const n = Number(value) / 1e18;
  if (!Number.isFinite(n)) return "…";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}
function satsToBtc(value?: bigint) {
  if (value === undefined) return "…";
  const wholePart = value / 100_000_000n;
  const fraction = (value % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  return fraction ? `${wholePart}.${fraction}` : wholePart.toString();
}
function money(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return "…";
  if (value === 0) return "$0.00";
  if (value < 0.01) return "<$0.01";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: value >= 1000 ? 0 : 2 });
}
function shortAddress(value?: string) { return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "…"; }

export default function PondPulse() {
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshCooling, setRefreshCooling] = useState(false);
  const refreshTimer = useRef<number | null>(null);
  const refreshLockUntil = useRef(0);
  const cbBtcUsd = useUsdPriceSingle(CBBTC_BASE);
  const ethUsd = useUsdPriceSingle("ETH");
  const taboshiUsd = useUsdPriceSingle(TABOSHI);

  const live = {
    chainId: base.id,
    query: {
      staleTime: 60_000,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  } as const;
  const totalDrawsRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "totalDraws", ...live });
  const treasuryRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "treasury", ...live });
  const priceRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "currentPrice", ...live });
  const openedRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "opened", ...live });
  const pausedRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "paused", ...live });
  const leavesRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "LEAVES_PER_ENHANCED_DRAW", chainId: base.id });
  const standardSeedsRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "STANDARD_SEEDS_PER_DRAW", chainId: base.id });
  const enhancedSeedsRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "ENHANCED_SEEDS_PER_DRAW", chainId: base.id });
  const seedSupplyRead = useReadContract({ address: TABOSHI_SEEDS_ADDRESS, abi: TABOSHI_SEEDS_ABI, functionName: "totalMinted", ...live });
  const taboshiBurnRead = useReadContract({ address: TABOSHI, abi: erc20Abi, functionName: "balanceOf", args: [DEAD_ADDRESS], ...live });
  const taboshiSupplyRead = useReadContract({ address: TABOSHI, abi: erc20Abi, functionName: "totalSupply", ...live });

  const treasury = typeof treasuryRead.data === "string" ? treasuryRead.data as Address : undefined;
  const treasuryCbBtcRead = useReadContract({ address: CBBTC_BASE, abi: erc20Abi, functionName: "balanceOf", args: [treasury ?? SEED_TREASURY], ...live });
  const treasuryEthRead = useBalance({ address: treasury ?? SEED_TREASURY, chainId: base.id, query: live.query });

  const totalDraws = typeof totalDrawsRead.data === "bigint" ? totalDrawsRead.data : undefined;
  const treasuryCbBtc = typeof treasuryCbBtcRead.data === "bigint" ? treasuryCbBtcRead.data : undefined;
  const treasuryEth = treasuryEthRead.data?.value;
  const taboshiBurned = typeof taboshiBurnRead.data === "bigint" ? taboshiBurnRead.data : undefined;
  const taboshiRawSupply = typeof taboshiSupplyRead.data === "bigint" ? taboshiSupplyRead.data : undefined;
  const taboshiRemaining =
    taboshiRawSupply === undefined || taboshiBurned === undefined
      ? undefined
      : taboshiRawSupply > taboshiBurned
        ? taboshiRawSupply - taboshiBurned
        : 0n;
  const currentPrice = typeof priceRead.data === "bigint" ? priceRead.data : undefined;
  const seedSupply = typeof seedSupplyRead.data === "bigint" ? seedSupplyRead.data : undefined;
  const standardSeeds = typeof standardSeedsRead.data === "bigint" ? standardSeedsRead.data : undefined;
  const enhancedSeeds = typeof enhancedSeedsRead.data === "bigint" ? enhancedSeedsRead.data : undefined;
  const leavesPer = typeof leavesRead.data === "bigint" ? leavesRead.data : undefined;

  const history = useMemo(() => deriveFaucetHistory({ totalDraws, totalSeeds: seedSupply, standardSeedsPerDraw: standardSeeds, enhancedSeedsPerDraw: enhancedSeeds, leavesPerEnhancedDraw: leavesPer }), [totalDraws, seedSupply, standardSeeds, enhancedSeeds, leavesPer]);
  const opened = openedRead.data === true;
  const paused = pausedRead.data === true;
  const status = paused ? "QUIET" : opened ? "RUNNING" : "CANARY";
  const treasuryUsd = treasuryCbBtc === undefined || !cbBtcUsd ? undefined : (Number(treasuryCbBtc) / 1e8) * cbBtcUsd;
  const treasuryEthUsd = treasuryEth === undefined || !ethUsd ? undefined : (Number(treasuryEth) / 1e18) * ethUsd;
  const totalTreasuryUsd = treasuryUsd === undefined ? undefined : treasuryUsd + (treasuryEthUsd ?? 0);
  const burnedUsd = taboshiBurned === undefined || !taboshiUsd ? undefined : (Number(taboshiBurned) / 1e18) * taboshiUsd;
  const remainingUsd = taboshiRemaining === undefined || !taboshiUsd ? undefined : (Number(taboshiRemaining) / 1e18) * taboshiUsd;
  const burnedPct =
    taboshiBurned === undefined || taboshiRawSupply === undefined || taboshiRawSupply === 0n
      ? undefined
      : (Number(taboshiBurned) / Number(taboshiRawSupply)) * 100;
  const depthUsd = currentPrice === undefined || !cbBtcUsd ? undefined : (Number(currentPrice) / 1e8) * cbBtcUsd;

  const castText = useMemo(() => {
    const leaves = history.leavesRetired === undefined ? "old leaves are returning" : `${whole(history.leavesRetired)} TABOSHI 1 burned`;
    const burned =
      taboshiRemaining === undefined || taboshiBurned === undefined
        ? "Taboshi supply is counting"
        : `${token18(taboshiRemaining)} TABOSHI remain · ${token18(taboshiBurned)} burned`;
    const btc = treasuryCbBtc === undefined ? "the pond treasury is counting" : `${satsToBtc(treasuryCbBtc)} cbBTC held in the pond treasury${totalTreasuryUsd === undefined ? "" : ` · ${money(totalTreasuryUsd)}`}`;
    const seeds = seedSupply === undefined ? "new seeds waking" : `${whole(seedSupply)} SEED purchased`;
    const draws = totalDraws === undefined ? "faucet draws are counting" : `${whole(totalDraws)} Seed purchases`;
    return `Pond Pulse 🌱\n\n${seeds} · ${draws}\n${leaves}\n${btc}\n${LORE_DEEDS_PURCHASED.toLocaleString()} Lore Deeds purchased\n${burned}\n\nLive on Base.`;
  }, [history.leavesRetired, seedSupply, taboshiBurned, taboshiRemaining, totalDraws, totalTreasuryUsd, treasuryCbBtc]);

  async function refresh() {
    const now = Date.now();
    if (refreshCooling || now < refreshLockUntil.current) return;
    refreshLockUntil.current = now + 20_000;
    setRefreshCooling(true);
    try {
      await Promise.allSettled([totalDrawsRead.refetch(), treasuryRead.refetch(), treasuryCbBtcRead.refetch(), treasuryEthRead.refetch(), taboshiBurnRead.refetch(), taboshiSupplyRead.refetch(), priceRead.refetch(), openedRead.refetch(), pausedRead.refetch(), seedSupplyRead.refetch()]);
    } finally {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => setRefreshCooling(false), 20_000);
    }
  }
  async function cast() {
    setSharing(true);
    try {
      const page = `${SITE_URL.replace(/\/$/, "")}#pond-pulse`;
      if (await composeCast({ text: castText, embeds: [page] })) return;
      const url = buildFarcasterComposeUrl({ text: castText, embeds: [page] });
      if (!(await openInMini(url))) window.open(url, "_blank", "noopener,noreferrer");
    } finally { setSharing(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(castText); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch {}
  }
  function shareOnX() {
    const page = `${SITE_URL.replace(/\/$/, "")}#pond-pulse`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(castText)}&url=${encodeURIComponent(page)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <section id="pond-pulse" className="pond-pulse scroll-mt-24" aria-label="Live Tobyworld ecosystem statistics">
      <div className="pond-pulse-shine" aria-hidden="true" />
      <Image src="/tokens/toby.PNG" alt="" width={110} height={110} className="pond-pulse-toby" aria-hidden="true" />
      <div className="pond-pulse-head">
        <div className="pond-pulse-title">
          <div className="pond-pulse-orb"><Image src="/ui/sato.webp" alt="" fill sizes="54px" className="object-contain" /></div>
          <div><span>LIVE ON BASE · POND LEDGER</span><h2>Pond Pulse</h2><p>Seeds, old leaves, Lore Deeds, cbBTC and TABOSHI scarcity in one shareable view.</p></div>
        </div>
        <button type="button" className="pond-pulse-status" onClick={refresh} disabled={refreshCooling} title={refreshCooling ? "Live stats refreshed — available again shortly" : "Refresh live stats"}><i className={paused ? "is-quiet" : ""} />{refreshCooling ? "SYNCED" : status}<b className={refreshCooling ? "is-cooling" : ""}>↻</b></button>
      </div>

      <div className="pond-pulse-feature-grid">
        <article className="pond-pulse-feature is-burn">
          <span className="pond-pulse-kicker">🍃 TABOSHI CIRCULATING</span>
          <strong>{token18(taboshiRemaining)}</strong>
          <small>
            {taboshiBurned === undefined
              ? "Reading the dead wallet…"
              : `${token18(taboshiBurned)} burned${burnedPct === undefined ? "" : ` · ${burnedPct.toFixed(2)}% of supply`}`}
          </small>
          <em>{money(remainingUsd)} effective supply value · {money(burnedUsd)} burned value</em>
        </article>
        <article className="pond-pulse-feature is-treasury">
          <span className="pond-pulse-kicker">₿ POND TREASURY</span>
          <strong>{treasuryCbBtc === undefined ? "…" : `${satsToBtc(treasuryCbBtc)} cbBTC`}</strong>
          <small>Live recognized holdings · {shortAddress(treasury ?? SEED_TREASURY)}</small>
          <em>{money(totalTreasuryUsd)} combined market value</em>
          <div className="pond-pulse-holdings" aria-label="Recognized treasury holdings">
            <span><i>₿</i><b>cbBTC</b><small>{satsToBtc(treasuryCbBtc)} · {money(treasuryUsd)}</small></span>
            <span><i>Ξ</i><b>ETH</b><small>{ethAmount(treasuryEth)} · {money(treasuryEthUsd)}</small></span>
          </div>
        </article>
      </div>

      <div className="pond-pulse-ledger is-seed-ledger">
        <div className="pond-pulse-ledger-head"><div><span>01 · SEED AWAKENING</span><h3>Old leaves return. New seeds wake.</h3></div><b>OPEN FAUCET</b></div>
        <div className="pond-pulse-grid is-four">
          <article className="pond-pulse-stat is-seed"><span>SEED PURCHASED</span><strong>{compactWhole(seedSupply)}</strong><small>Total SEED minted by the Faucet</small></article>
          <article className="pond-pulse-stat is-draw"><span>SEED PURCHASES</span><strong>{compactWhole(totalDraws)}</strong><small>Standard + enhanced draws</small></article>
          <article className="pond-pulse-stat is-leaf"><span>TABOSHI 1 BURNED</span><strong>{compactWhole(history.leavesRetired)}</strong><small>{history.enhancedDraws === undefined ? "Waiting for the draw mix" : `${whole(history.enhancedDraws)} enhanced purchases`}</small></article>
          <article className="pond-pulse-stat is-btc"><span>CURRENT SEED PRICE</span><strong>{currentPrice === undefined ? "…" : `${whole(currentPrice)} sats`}</strong><small>{money(depthUsd)} in cbBTC today</small></article>
        </div>
      </div>

      <div className="pond-pulse-ledger is-lore-ledger">
        <div className="pond-pulse-ledger-head"><div><span>02 · LORE LAND</span><h3>The deeds crossed the pond.</h3></div><b>HISTORICAL TOTALS</b></div>
        <div className="pond-pulse-grid is-three">
          <article className="pond-pulse-stat is-lore"><span>LORE DEEDS PURCHASED</span><strong>{LORE_DEEDS_PURCHASED.toLocaleString()}</strong><small>The canonical Tobyworld lands</small></article>
          <article className="pond-pulse-stat is-burned"><span>TABOSHI BURNED</span><strong>{token18(taboshiBurned)}</strong><small>{burnedPct === undefined ? "Reading fixed supply…" : `${burnedPct.toFixed(2)}% of the fixed supply`}</small></article>
          <article className="pond-pulse-stat is-circulating"><span>TABOSHI LEFT</span><strong>{token18(taboshiRemaining)}</strong><small>{money(remainingUsd)} live circulating value</small></article>
        </div>
      </div>

      <PondReserves
        seedTreasury={treasury ?? SEED_TREASURY}
        seedCbBtc={treasuryCbBtc}
        seedCbBtcUsd={treasuryUsd}
      />

      <div className="pond-pulse-footer">
        <div className="pond-pulse-whisper"><span>◌</span><p><b>TABOSHI circulating</b> equals fixed total supply minus the live balance at <b>0x…dEaD</b>. <b>Treasury holdings</b>, Faucet draws and SEED minted are read live from Base. USD values use current market prices and will move.</p></div>
        <div className="pond-pulse-actions"><button type="button" className="metal-button pond-pulse-cast" onClick={cast} disabled={sharing}>{sharing ? "Opening…" : "Cast pulse"}</button><button type="button" className="metal-button pond-pulse-x" onClick={shareOnX}>Post on X</button><button type="button" className="metal-button pond-pulse-copy" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button></div>
      </div>
    </section>
  );
}
