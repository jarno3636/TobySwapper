// components/TokensBurned.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReadContract } from "wagmi";
import { Address, formatUnits } from "viem";
import { SWAPPER } from "@/lib/addresses";

const SwapperAbi = [
  {
    type: "function",
    name: "totalTobyBurned",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

function fmt(n: number, maxFrac = 2) {
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

function useAnimatedNumber(target: number, duration = 800) {
  const [value, setValue] = useState(target);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(target);

  useEffect(() => {
    fromRef.current = value;
    startRef.current = null;

    let raf = 0;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setValue(fromRef.current + (target - fromRef.current) * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

export default function TokensBurned() {
  const { data } = useReadContract({
    address: SWAPPER as Address,
    abi: SwapperAbi,
    functionName: "totalTobyBurned",
    query: { refetchInterval: 20_000 },
  });

  const burned = useMemo(() => {
    try {
      return data ? Number(formatUnits(data as bigint, 18)) : 0;
    } catch {
      return 0;
    }
  }, [data]);

  const burnedAnim = useAnimatedNumber(burned, 900);
  const burnedPretty = fmt(burnedAnim);

  // 🔥 Progress toward next million
  const STEP = 1_000_000;
  const stepIdx = Math.floor(burned / STEP);
  const stepBase = stepIdx * STEP;
  const stepNext = (stepIdx + 1) * STEP;
  const stepProg = Math.max(0, Math.min(1, (burned - stepBase) / (stepNext - stepBase)));

  // Share text
  const castText = `🔥 ${fmt(burned, 2)} $TOBY burned forever!\nSwap, burn, and spread the lore 🐸🔥`;
  const farcasterUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(castText)}`;

  return (
    <div className="glass rounded-3xl p-6 shadow-soft mt-6 relative overflow-hidden">
      <div className="relative">
        <h3 className="text-xl font-bold mb-1 flex items-center justify-center gap-2">
          🔥 Tokens Burned
        </h3>

        <div className="text-center my-2">
          <div className="text-4xl md:text-5xl font-extrabold tracking-tight font-mono">
            {burnedPretty} <span className="text-lg align-top">TOBY</span>
          </div>
          <div className="text-inkSub text-xs mt-1">
            Milestone: {fmt(stepBase)} → {fmt(stepNext)} TOBY
          </div>
        </div>

        <div className="mt-4">
          <div className="flame-track rounded-full h-3 overflow-hidden">
            <div
              className="flame-fill h-full"
              style={{ width: `${stepProg * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-inkSub mt-1">
            <span>{fmt(stepBase)}</span>
            <span>{Math.round(stepProg * 100)}%</span>
            <span>{fmt(stepNext)}</span>
          </div>
        </div>

        {/* Share buttons */}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <a
            href={farcasterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pill bg-accent/20 hover:bg-accent/30 font-semibold"
          >
            Spread the Lore on Farcaster 🚀
          </a>
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pill bg-[#1DA1F2]/20 hover:bg-[#1DA1F2]/30 font-semibold"
          >
            Share on X 🐦🔥
          </a>
        </div>
      </div>
    </div>
  );
}
