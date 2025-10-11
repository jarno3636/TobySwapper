"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReadContract } from "wagmi";
import { Address } from "viem";
import { SWAPPER } from "@/lib/addresses";

const DECIMALS = 18n;
const SCALE = 10n ** DECIMALS;

/* ---------- Helpers ---------- */
const withThousands = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function formatAmount18(value: bigint, frac = 4) {
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
  const ONE_K = 1_000n, ONE_M = 1_000_000n, ONE_B = 1_000_000_000n, ONE_T = 1_000_000_000_000n;
  const fmt = (n: bigint, d: bigint, suf: string) =>
    `${(Number(n) / Number(d)).toFixed(2)}${suf}`;
  if (INT >= ONE_T) return fmt(INT, ONE_T, "T");
  if (INT >= ONE_B) return fmt(INT, ONE_B, "B");
  if (INT >= ONE_M) return fmt(INT, ONE_M, "M");
  if (INT >= ONE_K) return fmt(INT, ONE_K, "K");
  return formatAmount18(value, 4);
}

const useMounted = () => {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
};
const usePageVisible = () => {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  return visible;
};

/* ---------- Animated easing ---------- */
function useAnimatedBigint(target: bigint, duration = 700) {
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
      const eased = 1 - Math.pow(1 - p, 3);
      const diff = target - fromRef.current;
      const add = BigInt(Math.round(Number(diff) * eased));
      setValue(fromRef.current + add);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/* ---------- Component ---------- */
export default function TokensBurned() {
  const mounted = useMounted();
  const visible = usePageVisible();
  const [rot, setRot] = useState(false);

  const { data, refetch, isFetching, isError } = useReadContract({
    address: SWAPPER as Address,
    abi: [
      { type: "function", name: "totalTobyBurned", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    ] as const,
    functionName: "totalTobyBurned",
    query: {
      enabled: mounted && visible,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  });

  const burned18 = useMemo(() => (data ? (data as bigint) : 0n), [data]);
  const anim18 = useAnimatedBigint(burned18, 800);
  const pretty = burned18 / SCALE >= 1_000_000n ? formatCompact(anim18) : formatAmount18(anim18, 4);

  /* ---------- Dynamic milestone steps ---------- */
  const burnedInt = burned18 / SCALE; // whole-token units

  const TEN_M = 10_000_000n;
  const HUNDRED_M = 100_000_000n;
  const ONE_B = 1_000_000_000n;
  const TEN_B = 10_000_000_000n;
  const HUNDRED_B = 100_000_000_000n;

  function getStep(n: bigint): bigint {
    if (n < HUNDRED_M) return TEN_M;            // < 100M → 10M steps
    if (n < ONE_B) return HUNDRED_M;            // 100M–<1B → 100M steps
    if (n < TEN_B) return ONE_B;                // 1B–<10B → 1B steps
    if (n < HUNDRED_B) return TEN_B;            // 10B–<100B → 10B steps
    return HUNDRED_B;                           // ≥ 100B → 100B steps
  }

  const STEP = getStep(burnedInt);
  const stepIdx = burnedInt / STEP;
  const base = stepIdx * STEP;
  const next = (stepIdx + 1n) * STEP;
  const toNext = next - burnedInt;
  const progress = Math.min(
    100,
    Number(((burned18 - base * SCALE) * 10_000n) / (STEP * SCALE)) / 100
  );

  const doRefresh = async () => {
    if (isFetching) return;
    setRot(true);
    try {
      await refetch();
    } finally {
      setTimeout(() => setRot(false), 400);
    }
  };

  if (!mounted) return null;

  return (
    <div className="glass rounded-3xl p-6 shadow-soft mt-6 relative overflow-hidden content-visible">
      {/* Subtle flame gradient */}
      <div
        className="pointer-events-none absolute -inset-8 opacity-20 blur-2xl"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, rgba(255,110,64,.35) 0%, rgba(255,110,64,0) 60%), radial-gradient(50% 50% at 80% 40%, rgba(255,220,64,.25) 0%, rgba(255,220,64,0) 60%)",
        }}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold">🔥 Tokens Burned</h3>
          <button
            type="button"
            onClick={doRefresh}
            className="pill pill-opaque text-sm gap-2 select-none active:scale-[0.97]"
            aria-label="Refresh burned amount"
            disabled={isFetching}
          >
            <span
              aria-hidden
              style={{
                display: "inline-block",
                transform: rot ? "rotate(360deg)" : "rotate(0deg)",
                transition: "transform 0.35s ease",
              }}
            >
              🔥
            </span>
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {/* Animated number */}
        <div className="text-center my-2">
          <div className="text-4xl md:text-5xl font-extrabold tracking-tight font-mono">
            {isError ? "—" : pretty} <span className="text-lg align-top">TOBY</span>
          </div>
          <div className="text-inkSub text-xs mt-2">
            Milestone: {withThousands(base.toString())} → {withThousands(next.toString())}
          </div>
          <div className="text-inkSub text-[11px] mt-1">
            {withThousands(toNext.toString())} TOBY to next
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 rounded-full h-3 overflow-hidden border border-white/10 bg-white/5">
          <div
            className="h-full transition-all ease-out duration-500"
            style={{
              width: `${progress}%`,
              background:
                "linear-gradient(90deg, #ffa24d 0%, #ff6e40 35%, #ff3d00 70%, #ff9e80 100%)",
              boxShadow: "0 0 18px rgba(255,110,64,.55)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
