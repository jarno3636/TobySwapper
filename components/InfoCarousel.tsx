// components/InfoCarousel.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import type { Address } from "viem";
import { formatUnits } from "viem";
import { base } from "viem/chains";
import { useReadContracts, usePublicClient } from "wagmi";
import { TOBY, PATIENCE, TABOSHI, SWAPPER } from "@/lib/addresses";

/* ---------- ABIs ---------- */
const erc20Abi = [
  { type: "function", name: "name",        stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol",      stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals",    stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

type Item =
  | { kind: "token"; title: string; icon: string; address: Address }
  | { kind: "swapper"; title: string; icon: string; address: Address }
  | { kind: "link"; title: string; icon: string; href: string; blurb: string };

const ITEMS: Item[] = [
  { kind: "token",   title: "TOBY",     icon: "/tokens/toby.PNG",     address: TOBY },
  { kind: "token",   title: "PATIENCE", icon: "/tokens/patience.PNG", address: PATIENCE },
  { kind: "token",   title: "TABOSHI",  icon: "/tokens/taboshi.PNG",  address: TABOSHI },
  { kind: "swapper", title: "SWAPPER",  icon: "/toby2.PNG",           address: SWAPPER },
  { kind: "link",    title: "toadgod.xyz",  icon: "/tobyworld.PNG", href: "https://toadgod.xyz",         blurb: "Official site: lore, links, and updates." },
  { kind: "link",    title: "Telegram",     icon: "/toadlore.PNG",  href: "https://t.me/toadgang/212753", blurb: "Join Toadgang — community chat & alpha." },
  { kind: "link",    title: "@toadgod1017", icon: "/twitter.PNG",   href: "https://x.com/toadgod1017?s=21", blurb: "Follow on X for drops & news." },
];

/* ---------- Utils ---------- */
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

/* ---------- Panels ---------- */
function TokenPanel({ address, title, icon }: { address: Address; title: string; icon: string }) {
  // Primary (fast) reads via multicall
  const { data, isLoading } = useReadContracts({
    allowFailure: true,
    contracts: [
      { address, abi: erc20Abi, functionName: "name",        chainId: base.id },
      { address, abi: erc20Abi, functionName: "symbol",      chainId: base.id },
      { address, abi: erc20Abi, functionName: "decimals",    chainId: base.id },
      { address, abi: erc20Abi, functionName: "totalSupply", chainId: base.id },
    ],
    query: { refetchOnWindowFocus: false, staleTime: 30_000, gcTime: 120_000 },
  });

  // Fallback single-call reads if any field is missing
  const publicClient = usePublicClient({ chainId: base.id });
  const [fallback, setFallback] = useState<{
    name?: string; symbol?: string; decimals?: number; supply?: bigint;
  }>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!publicClient) return;

      const haveName = typeof data?.[0]?.result === "string";
      const haveSym  = typeof data?.[1]?.result === "string";
      const haveDec  = typeof data?.[2]?.result === "number";
      const haveSup  = typeof data?.[3]?.result === "bigint";

      if (haveName && haveSym && haveDec && haveSup) return;

      try {
        const [dec, nm, sym, sup] = await Promise.all([
          haveDec ? (data?.[2]?.result as number) :
            publicClient.readContract({ address, abi: erc20Abi, functionName: "decimals" }).catch(() => 18),
          haveName ? (data?.[0]?.result as string) :
            publicClient.readContract({ address, abi: erc20Abi, functionName: "name" }).catch(() => undefined),
          haveSym ? (data?.[1]?.result as string) :
            publicClient.readContract({ address, abi: erc20Abi, functionName: "symbol" }).catch(() => undefined),
          haveSup ? (data?.[3]?.result as bigint) :
            publicClient.readContract({ address, abi: erc20Abi, functionName: "totalSupply" }).catch(() => undefined),
        ]);
        if (!cancelled) setFallback({ name: nm, symbol: sym, decimals: dec, supply: sup });
      } catch {
        /* keep placeholders */
      }
    })();
    return () => { cancelled = true; };
  }, [publicClient, data, address]);

  const name      = (data?.[0]?.result as string | undefined) ?? fallback.name;
  const symbol    = (data?.[1]?.result as string | undefined) ?? fallback.symbol;
  const decimals  = (data?.[2]?.result as number | undefined) ?? fallback.decimals ?? 18;
  const supplyBig = (data?.[3]?.result as bigint | undefined) ?? fallback.supply;
  const supply    = supplyBig ? Number(formatUnits(supplyBig, decimals)) : undefined;

  const href = `https://basescan.org/address/${address}`;

  return (
    <div className="glass rounded-3xl p-5 shadow-soft w-full max-w-[420px] mx-auto text-sm content-visible">
      <div className="flex items-center gap-3 mb-3">
        <Image src={icon} alt={title} width={40} height={40} className="rounded-full" />
        <div>
          <h3 className="font-semibold">{title}</h3>
          <a href={href} className="link text-xs" target="_blank" rel="noreferrer">View on BaseScan ↗</a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[var(--ink-sub)]">Name</div>
          <div>{isLoading && !name ? "…" : (name ?? "—")}</div>
        </div>
        <div>
          <div className="text-[var(--ink-sub)]">Symbol</div>
          <div>{isLoading && !symbol ? "…" : (symbol ?? "—")}</div>
        </div>
        <div>
          <div className="text-[var(--ink-sub)]">Total Supply</div>
          <div>{isLoading && supply === undefined ? "…" : fmt(supply)}</div>
        </div>
      </div>
    </div>
  );
}

function SwapperPanel() {
  const href = `https://basescan.org/address/${SWAPPER}`;
  return (
    <div className="glass rounded-3xl p-5 shadow-soft w-full max-w-[420px] mx-auto text-sm content-visible">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">Toby Swapper</h3>
        <a href={href} className="link text-xs" target="_blank" rel="noreferrer">View ↗</a>
      </div>
      <p className="text-[var(--ink-sub)]">
        Routes swaps on Base and buys-&-burns <span className="font-semibold">$TOBY</span> with a 1% fee.
      </p>
    </div>
  );
}

function LinkPanel({ href, title, blurb, icon }: { href: string; title: string; blurb: string; icon: string }) {
  return (
    <div className="glass rounded-3xl p-5 shadow-soft w-full max-w-[420px] mx-auto text-sm content-visible">
      <div className="flex items-center gap-3 mb-2">
        <Image src={icon} alt={title} width={40} height={40} className="rounded-full" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-[var(--ink-sub)] mb-3">{blurb}</p>
      <a className="pill pill-opaque text-center" href={href} target="_blank" rel="noreferrer">Open ↗</a>
    </div>
  );
}

/* tiny preview for peeks */
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

/* ---------- Carousel ---------- */
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
      {/* Window with peeking neighbors (no arrows here) */}
      <div className="flex items-center justify-center w-full max-w-[560px] px-6 sm:px-8">
        <div className="w-full px-8 sm:px-10 md:px-12">
          <div className="flex items-stretch gap-4">
            {/* left peek */}
            <div className="w-[18%] opacity-50 pointer-events-none">
              <div className="glass rounded-2xl p-2 flex justify-center">
                <Mini item={ITEMS[leftIdx]} />
              </div>
            </div>

            {/* center image */}
            <div className="flex-1 flex justify-center">
              <div className="w-[52%] aspect-square glass rounded-3xl overflow-hidden shadow-soft flex justify-center items-center">
                <Image src={active.icon} alt={active.title} width={180} height={180} className="object-contain" />
              </div>
            </div>

            {/* right peek */}
            <div className="w-[18%] opacity-50 pointer-events-none">
              <div className="glass rounded-2xl p-2 flex justify-center">
                <Mini item={ITEMS[rightIdx]} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls row for arrows (below the window, never overlaps/extends off-screen) */}
      <div className="mt-3 w-full max-w-[560px] px-10 sm:px-12 md:px-16 flex items-center justify-between">
        <button onClick={prev} className="pill pill-opaque px-4 py-2" aria-label="Prev">←</button>
        <button onClick={next} className="pill pill-opaque px-4 py-2" aria-label="Next">→</button>
      </div>

      <h3 className="text-lg font-semibold mt-3">{active.title}</h3>

      {/* Info panel w/ slide animation */}
      <div
        className={`mt-5 w-full flex justify-center px-3 transition-all duration-400 ${
          animating ? "opacity-0 translate-y-6" : "opacity-100 translate-y-0"
        }`}
      >
        <div className="w-full max-w-[420px]">
          {active.kind === "token" ? (
            <TokenPanel address={(active as any).address} title={active.title} icon={active.icon} />
          ) : active.kind === "swapper" ? (
            <SwapperPanel />
          ) : (
            <LinkPanel
              href={(active as any).href}
              title={active.title}
              blurb={(active as any).blurb}
              icon={active.icon}
            />
          )}
        </div>
      </div>

      {/* dots */}
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
