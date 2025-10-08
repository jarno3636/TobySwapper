"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReadContract } from "wagmi";
import type { Address } from "viem";
import { base } from "viem/chains";
import { SWAPPER } from "@/lib/addresses";

const APP_URL = "https://tobyswap.vercel.app" as const;

const SwapperAbi = [
  {
    type: "function",
    name: "totalTobyBurned",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/* ---------------- BigInt format helpers ---------------- */
const DECIMALS = 18n;
const SCALE = 10n ** DECIMALS;

function withThousands(s: string) {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function formatAmount18(value: bigint, frac: number = 4) {
  if (value === 0n) return "0";
  const fracScale = 10n ** BigInt(Math.max(0, Number(DECIMALS) - frac));
  const rounded = (value + fracScale / 2n) / fracScale;
  const intPart = rounded / (10n ** BigInt(frac));
  let fracPart = (rounded % (10n ** BigInt(frac))).toString().padStart(frac, "0");
  fracPart = fracPart.replace(/0+$/, "");
  const intStr = withThousands(intPart.toString());
  return fracPart.length ? `${intStr}.${fracPart}` : intStr;
}
function formatCompact(value: bigint) {
  const INT = value / SCALE;
  const toFixed2 = (numTimes100n: bigint) => {
    const neg = numTimes100n < 0n ? "-" : "";
    const n = numTimes100n < 0n ? -numTimes100n : numTimes100n;
    const whole = n / 100n;
    const frac = (n % 100n).toString().padStart(2, "0");
    return `${neg}${withThousands(whole.toString())}.${frac}`;
  };
  const ONE_K = 1_000n, ONE_M = 1_000_000n, ONE_B = 1_000_000_000n, ONE_T = 1_000_000_000_000n;
  if (INT >= ONE_T) return `${toFixed2((INT * 100n) / ONE_T)}T`;
  if (INT >= ONE_B) return `${toFixed2((INT * 100n) / ONE_B)}B`;
  if (INT >= ONE_M) return `${toFixed2((INT * 100n) / ONE_M)}M`;
  if (INT >= ONE_K) return `${toFixed2((INT * 100n) / ONE_K)}K`;
  return formatAmount18(value, 4);
}

/* ---------------- Tiny odometer easing ---------------- */
function useAnimatedBigint(target: bigint, duration = 800) {
  const [value, setValue] = useState<bigint>(target);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef<bigint>(target);

  useEffect(() => {
    fromRef.current = value;
    startRef.current = null;
    let raf = 0;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      const diff = target - fromRef.current;
      const add = BigInt(Math.round(Number(diff) * e));
      setValue(fromRef.current + add);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, value]);

  return value;
}

export default function TokensBurned() {
  const { data, refetch, isFetching } = useReadContract({
    address: SWAPPER as Address,
    abi: SwapperAbi,
    functionName: "totalTobyBurned",
    chainId: base.id,               // ✅ ensure we read from Base
    query: {
      refetchInterval: 20_000,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  });

  const burned18 = useMemo(() => (typeof data === "bigint" ? data : 0n), [data]);
  const burnedAnim18 = useAnimatedBigint(burned18, 900);

  const burnedPretty =
    (burned18 / SCALE) >= 1_000_000n
      ? formatCompact(burnedAnim18)
      : formatAmount18(burnedAnim18, 4);

  // Milestones every 1,000,000 TOBY
  const STEP = 1_000_000n;
  const burnedInt = burned18 / SCALE;
  const stepIdx = burnedInt / STEP;
  const stepBaseInt = stepIdx * STEP;
  const stepNextInt = (stepIdx + 1n) * STEP;
  const stepNumerator18 = burned18 - stepBaseInt * SCALE;
  const stepDenominator18 = (stepNextInt - stepBaseInt) * SCALE;
  const progress = stepDenominator18 === 0n ? 0 : Number((stepNumerator18 * 10_000n) / stepDenominator18) / 100;

  const baseLabel = withThousands(stepBaseInt.toString());
  const nextLabel = withThousands(stepNextInt.toString());
  const toNext = stepNextInt > burnedInt ? stepNextInt - burnedInt : 0n;
  const toNextLabel = `${withThousands(toNext.toString())} TOBY to next`;

  // Share
  const shareText = `🔥 ${formatCompact(burned18)} $TOBY burned forever!\nSwap, burn, and spread the lore 🐸🔥\n${APP_URL}`;
  const farcasterUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`;
  const xText = `🔥 ${formatCompact(burned18)} $TOBY burned forever! Swap, burn, and spread the lore 🐸🔥 ${APP_URL}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(xText)}&url=${encodeURIComponent(APP_URL)}`;

  const onRefresh = async () => {
    try { await refetch?.(); } catch {}
  };

  return (
    <div className="glass rounded-3xl p-6 shadow-soft mt-6 relative overflow-hidden">
      {/* subtle flame aura */}
      <div
        className="pointer-events-none absolute -inset-8 opacity-20 blur-2xl"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, rgba(255,110,64,.35) 0%, rgba(255,110,64,0) 60%), radial-gradient(50% 50% at 80% 40%, rgba(255,220,64,.25) 0%, rgba(255,220,64,0) 60%)",
        }}
      />

      {/* 🔥 Flame refresh button */}
      <button
        type="button"
        onClick={onRefresh}
        disabled={isFetching}
        aria-label="Refresh burned total"
        title="Refresh burned total"
        className="absolute right-3 top-3 h-10 w-10 rounded-full pill-opaque flex items-center justify-center border border-white/15 shadow-soft hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-60"
      >
        <span
          className={`text-xl drop-shadow ${isFetching ? "animate-spin" : "animate-none"}`}
          style={{ filter: "drop-shadow(0 0 8px rgba(255,110,64,.6))" }}
        >
          🔥
        </span>
      </button>

      <div className="relative">
        <h3 className="text-xl font-bold mb-2 text-center flex items-center justify-center gap-2">
          🔥 Tokens Burned
        </h3>

        {/* Big number */}
        <div className="text-center my-2">
          <div className="text-4xl md:text-5xl font-extrabold tracking-tight font-mono">
            {burnedPretty} <span className="text-lg align-top">TOBY</span>
          </div>
          <div className="text-inkSub text-xs mt-2">
            Milestone: {baseLabel} → {nextLabel}
          </div>
          <div className="text-inkSub text-[11px] mt-1">{toNextLabel}</div>
        </div>

        {/* Flame progress */}
        <div className="mt-4">
          <div
            className="rounded-full h-3 overflow-hidden"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.04))",
              border: "1px solid rgba(255,255,255,.12)",
            }}
          >
            <div
              className="h-full"
              style={{
                width: `${progress}%`,
                background:
                  "linear-gradient(90deg, #ffa24d 0%, #ff6e40 35%, #ff3d00 70%, #ff9e80 100%)",
                boxShadow: "0 0 18px rgba(255,110,64,.55)",
                transition: "width 400ms ease",
              }}
            />
          </div>
        </div>

        {/* Share buttons */}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <a
            href={farcasterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pill pill-opaque hover:opacity-90 font-semibold"
          >
            Spread the Lore on Farcaster
          </a>
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pill pill-opaque hover:opacity-90 font-semibold"
          >
            Share on X 🐦
          </a>
        </div>
      </div>
    </div>
  );
}
