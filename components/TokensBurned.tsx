"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReadContract } from "wagmi";
import { Address } from "viem";
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

// ---------- BigInt-safe formatting (18 decimals -> human) ----------
const TEN = 10n;
const DECIMALS = 18n;
const SCALE = 10n ** DECIMALS;

/** Format with up to `frac` decimal places, trimmed, using only BigInt math. */
function formatAmount18(value: bigint, frac: number = 4) {
  if (value === 0n) return "0";
  const fracScale = 10n ** BigInt(Math.max(0, Number(DECIMALS) - frac));
  const rounded = (value + fracScale / 2n) / fracScale; // round half-up to target precision
  const intPart = rounded / (10n ** BigInt(frac));
  let fracPart = (rounded % (10n ** BigInt(frac))).toString().padStart(frac, "0");

  // trim trailing zeros in fraction
  fracPart = fracPart.replace(/0+$/, "");
  const intStr = withThousands(intPart.toString());
  return fracPart.length ? `${intStr}.${fracPart}` : intStr;
}

/** Compact K/M/B/T with 2 decimals (BigInt safe). */
function formatCompact(value: bigint) {
  const ONE_K = 1_000n, ONE_M = 1_000_000n, ONE_B = 1_000_000_000n, ONE_T = 1_000_000_000_000n;
  const INT = value / SCALE;
  const toFixed2 = (numTimes100n: bigint) => {
    const neg = numTimes100n < 0n ? "-" : "";
    const n = numTimes100n < 0n ? -numTimes100n : numTimes100n;
    const whole = n / 100n;
    const frac = (n % 100n).toString().padStart(2, "0");
    return `${neg}${withThousands(whole.toString())}.${frac}`;
  };

  if (INT >= ONE_T) return `${toFixed2((INT * 100n) / ONE_T)}T`;
  if (INT >= ONE_B) return `${toFixed2((INT * 100n) / ONE_B)}B`;
  if (INT >= ONE_M) return `${toFixed2((INT * 100n) / ONE_M)}M`;
  if (INT >= ONE_K) return `${toFixed2((INT * 100n) / ONE_K)}K`;
  // < 1K: show normal with up to 4 decimals
  return formatAmount18(value, 4);
}

function withThousands(s: string) {
  // simple thousands formatter for integer strings
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ---------- Tiny odometer easing for display only ----------
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
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      // interpolate using Number for the easing factor only; apply to bigint range safely
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
  const { data } = useReadContract({
    address: SWAPPER as Address,
    abi: SwapperAbi,
    functionName: "totalTobyBurned",
    query: { refetchInterval: 20_000, staleTime: 10_000, refetchOnWindowFocus: false },
  });

  // Raw on-chain value (18 decimals)
  const burned18 = useMemo(() => (data ? (data as bigint) : 0n), [data]);
  const burnedAnim18 = useAnimatedBigint(burned18, 900);

  // Display as compact for huge numbers, otherwise nice fixed up to 4 decimals
  const burnedPretty =
    (burned18 / SCALE) >= 1_000_000n ? formatCompact(burnedAnim18) : formatAmount18(burnedAnim18, 4);

  // Milestones: every 1,000,000 TOBY (integer units)
  const STEP = 1_000_000n;
  const burnedInt = burned18 / SCALE;
  const stepIdx = burnedInt / STEP;
  const stepBaseInt = stepIdx * STEP;
  const stepNextInt = (stepIdx + 1n) * STEP;

  // For the progress bar we compute fractional progress within the step using bigints
  const stepNumerator18 = burned18 - stepBaseInt * SCALE; // amount into current step, 18-dec
  const stepDenominator18 = (stepNextInt - stepBaseInt) * SCALE; // 1,000,000 * 1e18
  const progress = stepDenominator18 === 0n ? 0 : Number((stepNumerator18 * 10_000n) / stepDenominator18) / 100; // 0..100

  // Labels
  const baseLabel = withThousands(stepBaseInt.toString());
  const nextLabel = withThousands(stepNextInt.toString());
  const toNext = stepNextInt > burnedInt ? stepNextInt - burnedInt : 0n; // whole tokens to next
  const toNextLabel = `${withThousands(toNext.toString())} TOBY to next`;

  // Share links (use compact original value for the post)
  const shareText = `🔥 ${formatCompact(burned18)} $TOBY burned forever!\nSwap, burn, and spread the lore 🐸🔥\n${APP_URL}`;
  const farcasterUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`;
  const xText = `🔥 ${formatCompact(burned18)} $TOBY burned forever! Swap, burn, and spread the lore 🐸🔥 ${APP_URL}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(xText)}&url=${encodeURIComponent(APP_URL)}`;

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

        {/* Flame progress (no percentage label) */}
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
                // animated flame-y gradient
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
            aria-label="Share on Farcaster"
          >
            Spread the Lore on Farcaster 🚀
          </a>
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pill pill-opaque hover:opacity-90 font-semibold"
            aria-label="Share on X"
          >
            Share on X 🐦🔥
          </a>
        </div>
      </div>
    </div>
  );
}
