"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Address, formatUnits } from "viem";
import { base } from "viem/chains";
import { useReadContracts } from "wagmi";
import { TOBY, PATIENCE, TABOSHI, SWAPPER } from "@/lib/addresses";

/* --- Same ABIs & ITEMS as before --- */
/* ... unchanged constants ... */

/* Quick number format helper */
const fmt = (n?: number, max = 4) =>
  n === undefined || !isFinite(n)
    ? "—"
    : n >= 1e9
    ? (n / 1e9).toFixed(2) + "B"
    : n >= 1e6
    ? (n / 1e6).toFixed(2) + "M"
    : n >= 1e3
    ? (n / 1e3).toFixed(2) + "K"
    : n.toLocaleString(undefined, { maximumFractionDigits: max });

/* --- Panels (unchanged structurally but lighter classNames & caching) --- */
/* Keep your TokenPanel, SwapperPanel, and LinkPanel exactly, just wrap in content-visible divs */

function Mini({ item }: { item: Item }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative inline-block w-7 h-7 rounded-lg overflow-hidden">
        <Image src={item.icon} alt={item.title} fill sizes="28px" className="object-cover" />
      </span>
      <span className="text-xs font-medium truncate max-w-[70px]">{item.title}</span>
    </div>
  );
}

/* --- Carousel --- */
export default function InfoCarousel() {
  const [index, setIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  const prev = useCallback(() => {
    setAnimating(true);
    setIndex((i) => (i - 1 + ITEMS.length) % ITEMS.length);
  }, []);
  const next = useCallback(() => {
    setAnimating(true);
    setIndex((i) => (i + 1) % ITEMS.length);
  }, []);

  // mobile swipe
  useEffect(() => {
    let startX: number | null = null;
    const handleTouchStart = (e: TouchEvent) => (startX = e.touches[0].clientX);
    const handleTouchEnd = (e: TouchEvent) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 60) (dx > 0 ? prev() : next());
    };
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [prev, next]);

  useEffect(() => {
    const t = setTimeout(() => setAnimating(false), 350);
    return () => clearTimeout(t);
  }, [index]);

  const active = ITEMS[index];
  const leftIdx = (index - 1 + ITEMS.length) % ITEMS.length;
  const rightIdx = (index + 1) % ITEMS.length;

  return (
    <div className="flex flex-col items-center w-full overflow-hidden content-visible">
      <div className="relative flex items-center justify-center w-full max-w-[520px]">
        <button onClick={prev} className="absolute left-0 pill pill-opaque px-3 py-1" aria-label="Prev">←</button>
        <div className="w-full px-10">
          <div className="flex items-stretch gap-4">
            <div className="w-[16%] opacity-50 pointer-events-none">
              <div className="glass rounded-2xl p-2 flex justify-center"><Mini item={ITEMS[leftIdx]} /></div>
            </div>
            <div className="flex-1 flex justify-center">
              <div className="w-[50%] aspect-square glass rounded-3xl overflow-hidden shadow-soft flex justify-center items-center">
                <Image src={active.icon} alt={active.title} width={180} height={180} className="object-contain" />
              </div>
            </div>
            <div className="w-[16%] opacity-50 pointer-events-none">
              <div className="glass rounded-2xl p-2 flex justify-center"><Mini item={ITEMS[rightIdx]} /></div>
            </div>
          </div>
        </div>
        <button onClick={next} className="absolute right-0 pill pill-opaque px-3 py-1" aria-label="Next">→</button>
      </div>

      <h3 className="text-lg font-semibold mt-3">{active.title}</h3>

      <div className={`mt-5 w-full flex justify-center px-3 transition-all duration-400 ${
        animating ? "opacity-0 translate-y-6" : "opacity-100 translate-y-0"
      }`}>
        <div className="w-full max-w-[420px]">
          {active.kind === "token" ? (
            <TokenPanel {...(active as any)} />
          ) : active.kind === "swapper" ? (
            <SwapperPanel />
          ) : (
            <LinkPanel {...(active as any)} />
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-2 justify-center">
        {ITEMS.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-2.5 w-2.5 rounded-full ${i === index ? "bg-[var(--accent)]" : "bg-white/20"}`}
          />
        ))}
      </div>
    </div>
  );
}
