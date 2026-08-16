"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { erc20Abi, type Address } from "viem";
import { base } from "viem/chains";
import { useReadContract } from "wagmi";
import { TABOSHI } from "@/lib/addresses";
import { composeCast, buildFarcasterComposeUrl, openInMini, SITE_URL } from "@/lib/miniapps";
import { useUsdPriceSingle } from "@/lib/prices";
import { OPEN_FAUCET_ADDRESS, OPEN_FAUCET_ABI, deriveFaucetHistory } from "@/lib/open-faucet";
import { TABOSHI_SEEDS_ADDRESS, TABOSHI_SEEDS_ABI } from "@/lib/taboshi-seeds";

const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD" as Address;
const CBBTC_BASE = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf" as Address;
const SEED_TREASURY = "0xe4A4D0235cDB57B8e7a74F2A9D1B4bCe6941f79F" as Address;

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
  const cbBtcUsd = useUsdPriceSingle(CBBTC_BASE);
  const taboshiUsd = useUsdPriceSingle(TABOSHI);

  const live = { chainId: base.id, query: { refetchInterval: 15_000 } } as const;
  const totalDrawsRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "totalDraws", ...live });
  const retainedRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "retainedCbBTC", ...live });
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
  const treasuryCbBtcRead = useReadContract({ address: CBBTC_BASE, abi: erc20Abi, functionName: "balanceOf", args: [SEED_TREASURY], ...live });

  const totalDraws = typeof totalDrawsRead.data === "bigint" ? totalDrawsRead.data : undefined;
  const retained = typeof retainedRead.data === "bigint" ? retainedRead.data : undefined;
  const treasuryCbBtc = typeof treasuryCbBtcRead.data === "bigint" ? treasuryCbBtcRead.data : undefined;
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
  const burnedUsd = taboshiBurned === undefined || !taboshiUsd ? undefined : (Number(taboshiBurned) / 1e18) * taboshiUsd;
  const remainingUsd = taboshiRemaining === undefined || !taboshiUsd ? undefined : (Number(taboshiRemaining) / 1e18) * taboshiUsd;
  const burnedPct =
    taboshiBurned === undefined || taboshiRawSupply === undefined || taboshiRawSupply === 0n
      ? undefined
      : (Number(taboshiBurned) / Number(taboshiRawSupply)) * 100;
  const depthUsd = currentPrice === undefined || !cbBtcUsd ? undefined : (Number(currentPrice) / 1e8) * cbBtcUsd;

  const castText = useMemo(() => {
    const leaves = history.leavesRetired === undefined ? "old leaves are returning" : `${whole(history.leavesRetired)} Taboshi1 returned`;
    const burned =
      taboshiRemaining === undefined || taboshiBurned === undefined
        ? "Taboshi supply is counting"
        : `${token18(taboshiRemaining)} TABOSHI remain · ${token18(taboshiBurned)} retired`;
    const btc = treasuryCbBtc === undefined ? "treasury cbBTC is gathering" : `${satsToBtc(treasuryCbBtc)} cbBTC in treasury`;
    const seeds = seedSupply === undefined ? "new seeds waking" : `${whole(seedSupply)} SEED awakened`;
    return `pond pulse 🌱\n\n${leaves}\n${burned}\n${btc}\n${seeds}\n\nold leaves return. new seeds wake.`;
  }, [history.leavesRetired, taboshiBurned, taboshiRemaining, treasuryCbBtc, seedSupply]);

  async function refresh() {
    await Promise.allSettled([totalDrawsRead.refetch(), retainedRead.refetch(), treasuryRead.refetch(), treasuryCbBtcRead.refetch(), taboshiBurnRead.refetch(), taboshiSupplyRead.refetch(), priceRead.refetch(), openedRead.refetch(), pausedRead.refetch(), seedSupplyRead.refetch()]);
  }
  async function cast() {
    setSharing(true);
    try {
      const page = `${SITE_URL.replace(/\/$/, "")}/taboshi1`;
      if (await composeCast({ text: castText, embeds: [page] })) return;
      const url = buildFarcasterComposeUrl({ text: castText, embeds: [page] });
      if (!(await openInMini(url))) window.open(url, "_blank", "noopener,noreferrer");
    } finally { setSharing(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(castText); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch {}
  }

  return (
    <section className="pond-pulse" aria-label="Live Open Faucet statistics">
      <div className="pond-pulse-shine" aria-hidden="true" />
      <Image src="/tokens/toby.PNG" alt="" width={110} height={110} className="pond-pulse-toby" aria-hidden="true" />
      <div className="pond-pulse-head">
        <div className="pond-pulse-title">
          <div className="pond-pulse-orb"><Image src="/tokens/sato.PNG" alt="" fill sizes="54px" className="object-contain" /></div>
          <div><span>LIVE ON BASE · POND LEDGER</span><h2>Pond pulse</h2><p>Burns, treasury depth, seeds and draws — read straight from the pond.</p></div>
        </div>
        <button type="button" className="pond-pulse-status" onClick={refresh} title="Refresh live stats"><i className={paused ? "is-quiet" : ""} />{status}<b>↻</b></button>
      </div>

      <div className="pond-pulse-feature-grid">
        <article className="pond-pulse-feature is-burn">
          <span className="pond-pulse-kicker">🍃 TABOSHI REMAINING</span>
          <strong>{token18(taboshiRemaining)}</strong>
          <small>
            {taboshiBurned === undefined
              ? "Reading the dead wallet…"
              : `${token18(taboshiBurned)} retired${burnedPct === undefined ? "" : ` · ${burnedPct.toFixed(2)}% burned`}`}
          </small>
          <em>{money(remainingUsd)} effective supply value · {money(burnedUsd)} retired value</em>
        </article>
        <article className="pond-pulse-feature is-treasury">
          <span className="pond-pulse-kicker">₿ TREASURY DEPTH</span>
          <strong>{treasuryCbBtc === undefined ? "…" : `${satsToBtc(treasuryCbBtc)} cbBTC`}</strong>
          <small>{treasury ? `Treasury ${shortAddress(treasury)}` : `Treasury ${shortAddress(SEED_TREASURY)}`}</small>
          <em>{money(treasuryUsd)} current value</em>
        </article>
      </div>

      <div className="pond-pulse-grid">
        <article className="pond-pulse-stat is-leaf"><span>OLD LEAVES RETURNED</span><strong>{compactWhole(history.leavesRetired)}</strong><small>{history.enhancedDraws === undefined ? "waiting for the draw mix" : `${whole(history.enhancedDraws)} enhanced draws`}</small></article>
        <article className="pond-pulse-stat is-seed"><span>SEEDS AWAKENED</span><strong>{compactWhole(seedSupply)}</strong><small>SEED minted by the Faucet</small></article>
        <article className="pond-pulse-stat is-draw"><span>TOTAL DRAWS</span><strong>{compactWhole(totalDraws)}</strong><small>{currentPrice === undefined ? "current depth loading" : `depth · ${whole(currentPrice)} sats · ${money(depthUsd)}`}</small></article>
        <article className="pond-pulse-stat is-btc"><span>FAUCET RETAINED</span><strong>{retained === undefined ? "…" : `${compactWhole(retained)} sats`}</strong><small>Contract-local retained cbBTC</small></article>
      </div>

      <div className="pond-pulse-footer">
        <div className="pond-pulse-whisper"><span>◌</span><p><b>TABOSHI remaining</b> is the token contract&apos;s fixed total supply minus the live balance at <b>0x…dEaD</b>. Because TABOSHI cannot be minted, every token retired there reduces the effective supply shown here. <b>Treasury depth</b> is the live cbBTC balance at the Faucet-reported treasury.</p></div>
        <div className="pond-pulse-actions"><button type="button" className="metal-button pond-pulse-cast" onClick={cast} disabled={sharing}>{sharing ? "Opening…" : "Cast the ripple"}</button><button type="button" className="metal-button pond-pulse-copy" onClick={copy}>{copied ? "Copied ✓" : "Copy pulse"}</button></div>
      </div>
    </section>
  );
}
