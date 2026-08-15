"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { base } from "viem/chains";
import { useReadContract } from "wagmi";
import { composeCast, buildFarcasterComposeUrl, openInMini, SITE_URL } from "@/lib/miniapps";
import {
  OPEN_FAUCET_ADDRESS,
  OPEN_FAUCET_ABI,
  deriveFaucetHistory,
} from "@/lib/open-faucet";
import {
  TABOSHI_SEEDS_ADDRESS,
  TABOSHI_SEEDS_ABI,
} from "@/lib/taboshi-seeds";

function whole(value?: bigint) {
  return value === undefined ? "…" : value.toLocaleString();
}

function compactWhole(value?: bigint) {
  if (value === undefined) return "…";
  const n = Number(value);
  if (!Number.isFinite(n)) return value.toLocaleString();
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return n.toLocaleString();
}

function satsToBtc(value?: bigint) {
  if (value === undefined) return "…";
  const wholePart = value / 100_000_000n;
  const fraction = (value % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  return fraction ? `${wholePart}.${fraction}` : wholePart.toString();
}

export default function PondPulse() {
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const totalDrawsRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "totalDraws", chainId: base.id, query: { refetchInterval: 15_000 } });
  const retainedRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "retainedCbBTC", chainId: base.id, query: { refetchInterval: 15_000 } });
  const priceRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "currentPrice", chainId: base.id, query: { refetchInterval: 15_000 } });
  const openedRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "opened", chainId: base.id, query: { refetchInterval: 15_000 } });
  const pausedRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "paused", chainId: base.id, query: { refetchInterval: 15_000 } });
  const leavesRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "LEAVES_PER_ENHANCED_DRAW", chainId: base.id });
  const standardSeedsRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "STANDARD_SEEDS_PER_DRAW", chainId: base.id });
  const enhancedSeedsRead = useReadContract({ address: OPEN_FAUCET_ADDRESS, abi: OPEN_FAUCET_ABI, functionName: "ENHANCED_SEEDS_PER_DRAW", chainId: base.id });
  const seedSupplyRead = useReadContract({ address: TABOSHI_SEEDS_ADDRESS, abi: TABOSHI_SEEDS_ABI, functionName: "totalMinted", chainId: base.id, query: { refetchInterval: 15_000 } });

  const totalDraws = typeof totalDrawsRead.data === "bigint" ? totalDrawsRead.data : undefined;
  const retained = typeof retainedRead.data === "bigint" ? retainedRead.data : undefined;
  const currentPrice = typeof priceRead.data === "bigint" ? priceRead.data : undefined;
  const seedSupply = typeof seedSupplyRead.data === "bigint" ? seedSupplyRead.data : undefined;
  const standardSeeds = typeof standardSeedsRead.data === "bigint" ? standardSeedsRead.data : undefined;
  const enhancedSeeds = typeof enhancedSeedsRead.data === "bigint" ? enhancedSeedsRead.data : undefined;
  const leavesPer = typeof leavesRead.data === "bigint" ? leavesRead.data : undefined;

  const history = useMemo(
    () => deriveFaucetHistory({ totalDraws, totalSeeds: seedSupply, standardSeedsPerDraw: standardSeeds, enhancedSeedsPerDraw: enhancedSeeds, leavesPerEnhancedDraw: leavesPer }),
    [totalDraws, seedSupply, standardSeeds, enhancedSeeds, leavesPer],
  );

  const opened = openedRead.data === true;
  const paused = pausedRead.data === true;
  const status = paused ? "QUIET" : opened ? "RUNNING" : "CANARY";

  const castText = useMemo(() => {
    const leaves = history.leavesRetired === undefined ? "old leaves are returning" : `${whole(history.leavesRetired)} old leaves returned`;
    const sats = retained === undefined ? "cbBTC gathering in the pond" : `${whole(retained)} sats retained`;
    const seeds = seedSupply === undefined ? "new seeds waking" : `${whole(seedSupply)} SEED awakened`;
    const draws = totalDraws === undefined ? "the tap is counting" : `${whole(totalDraws)} draws`;
    return `the tap runs. 🌱\n\n${leaves}\n${sats}\n${seeds}\n${draws}\n\nold leaves return. new seeds wake.`;
  }, [history.leavesRetired, retained, seedSupply, totalDraws]);

  async function refresh() {
    await Promise.allSettled([
      totalDrawsRead.refetch(), retainedRead.refetch(), priceRead.refetch(), openedRead.refetch(), pausedRead.refetch(), seedSupplyRead.refetch(),
    ]);
  }

  async function cast() {
    setSharing(true);
    try {
      const page = `${SITE_URL.replace(/\/$/, "")}/taboshi1`;
      if (await composeCast({ text: castText, embeds: [page] })) return;
      const url = buildFarcasterComposeUrl({ text: castText, embeds: [page] });
      if (!(await openInMini(url))) window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setSharing(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(castText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  return (
    <section className="pond-pulse" aria-label="Live Open Faucet statistics">
      <div className="pond-pulse-shine" aria-hidden="true" />
      <div className="pond-pulse-head">
        <div className="pond-pulse-title">
          <div className="pond-pulse-orb"><Image src="/tokens/sato.PNG" alt="" fill sizes="54px" className="object-contain" /></div>
          <div><span>THE TAP · LIVE FROM BASE</span><h2>Pond pulse</h2><p>The numbers the pond leaves behind.</p></div>
        </div>
        <button type="button" className="pond-pulse-status" onClick={refresh} title="Refresh live stats"><i className={paused ? "is-quiet" : ""} />{status}<b>↻</b></button>
      </div>

      <div className="pond-pulse-grid">
        <article className="pond-pulse-stat is-leaf"><span>OLD LEAVES RETURNED</span><strong>{compactWhole(history.leavesRetired)}</strong><small>{history.enhancedDraws === undefined ? "waiting for the draw mix" : `${whole(history.enhancedDraws)} enhanced draws`}</small></article>
        <article className="pond-pulse-stat is-btc"><span>BTC IN THE TAP</span><strong>{retained === undefined ? "…" : `${compactWhole(retained)} sats`}</strong><small>{retained === undefined ? "cbBTC retained" : `${satsToBtc(retained)} cbBTC retained`}</small></article>
        <article className="pond-pulse-stat is-seed"><span>SEEDS AWAKENED</span><strong>{compactWhole(seedSupply)}</strong><small>SEED minted by the Faucet</small></article>
        <article className="pond-pulse-stat is-draw"><span>DRAWS</span><strong>{compactWhole(totalDraws)}</strong><small>{currentPrice === undefined ? "current depth loading" : `current depth · ${whole(currentPrice)} sats`}</small></article>
      </div>

      <div className="pond-pulse-footer">
        <div className="pond-pulse-whisper"><span>◌</span><p>Old-leaf retirement is recovered from the onchain draw mix—no history scan needed.</p></div>
        <div className="pond-pulse-actions">
          <button type="button" className="metal-button pond-pulse-cast" onClick={cast} disabled={sharing}>{sharing ? "Opening…" : "Cast the ripple"}</button>
          <button type="button" className="metal-button pond-pulse-copy" onClick={copy}>{copied ? "Copied ✓" : "Copy numbers"}</button>
        </div>
      </div>
    </section>
  );
}
