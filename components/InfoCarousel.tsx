"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Address, formatUnits } from "viem";
import { base } from "viem/chains";
import { useReadContracts } from "wagmi";
import { TOBY, PATIENCE, TABOSHI, SWAPPER } from "@/lib/addresses";

/* ---------- ABIs ---------- */
const erc20Abi = [
  { type: "function", name: "name",        stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol",      stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals",    stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

type Item =
  | { kind: "token";  title: string; icon: string; address: Address }
  | { kind: "swapper"; title: string; icon: string; address: Address }
  | { kind: "link";   title: string; icon: string; href: string; blurb: string };

const ITEMS: Item[] = [
  { kind: "token",   title: "TOBY",     icon: "/tokens/toby.PNG",     address: TOBY },
  { kind: "token",   title: "PATIENCE", icon: "/tokens/patience.PNG", address: PATIENCE },
  { kind: "token",   title: "TABOSHI",  icon: "/tokens/taboshi.PNG",  address: TABOSHI },
  { kind: "swapper", title: "SWAPPER",  icon: "/toby2.PNG",           address: SWAPPER },
  { kind: "link",    title: "toadgod.xyz",  icon: "/tobyworld.PNG", href: "https://toadgod.xyz",
    blurb: "Official site: lore, links, and updates." },
  { kind: "link",    title: "Telegram",     icon: "/toadlore.PNG", href: "https://t.me/toadgang/212753",
    blurb: "Join Toadgang — community chat & alpha." },
  { kind: "link",    title: "@toadgod1017", icon: "/twitter.PNG", href: "https://x.com/toadgod1017?s=21",
    blurb: "Follow on X for drops & news." },
];

/* ---------- Helpers ---------- */
function fmt(n?: number, max = 4) {
  if (n === undefined || !isFinite(n)) return "—";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)         return (n / 1_000).toFixed(2) + "K";
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
}

/* ---------- Panels ---------- */
function TokenPanel({ address, title, icon }: { address: Address; title: string; icon: string }) {
  const { data, isLoading } = useReadContracts({
    allowFailure: true,
    contracts: [
      { address, abi: erc20Abi, functionName: "name",        chainId: base.id },
      { address, abi: erc20Abi, functionName: "symbol",      chainId: base.id },
      { address, abi: erc20Abi, functionName: "decimals",    chainId: base.id },
      { address, abi: erc20Abi, functionName: "totalSupply", chainId: base.id },
    ],
    query: { refetchOnWindowFocus: false, staleTime: 15_000, gcTime: 60_000 },
  });

  const name = data?.[0]?.result as string | undefined;
  const symbol = data?.[1]?.result as string | undefined;
  const decimals = (data?.[2]?.result as number | undefined) ?? 18;
  const supplyBig = data?.[3]?.result as bigint | undefined;
  const supply = supplyBig ? Number(formatUnits(supplyBig, decimals)) : undefined;

  // OPTIONAL holders via API route /api/holders?address=...
  const [holders, setHolders] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/holders?address=${address}`);
        if (!alive) return;
        if (r.ok) {
          const { holders } = await r.json();
          setHolders(typeof holders === "number" ? holders : null);
        } else {
          setHolders(null);
        }
      } catch {
        setHolders(null);
      }
    })();
    return () => { alive = false; };
  }, [address]);

  const href = `https://basescan.org/address/${address}`;

  return (
    <div className="glass rounded-3xl p-5 shadow-soft w-full">
      <div className="flex items-center gap-3 mb-4">
        <span className="relative inline-block w-10 h-10 rounded-full overflow-hidden">
          <Image src={icon} alt={title} fill sizes="40px" className="object-cover" />
        </span>
        <div>
          <h3 className="font-semibold leading-tight">{title}</h3>
          <a className="text-sm link" href={href} target="_blank" rel="noopener noreferrer">
            View on BaseScan ↗
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-[var(--ink-sub)]">Name</div>
          <div className="font-mono">{isLoading ? "…" : name ?? "—"}</div>
        </div>
        <div>
          <div className="text-[var(--ink-sub)]">Symbol</div>
          <div className="font-mono">{isLoading ? "…" : symbol ?? "—"}</div>
        </div>
        <div>
          <div className="text-[var(--ink-sub)]">Total Supply</div>
          <div className="font-mono">{isLoading ? "…" : fmt(supply)}</div>
        </div>
        <div>
          <div className="text-[var(--ink-sub)]">Holders</div>
          <div className="font-mono">{holders === null ? "—" : fmt(holders, 0)}</div>
        </div>
      </div>
    </div>
  );
}

function SwapperPanel() {
  const href = `https://basescan.org/address/${SWAPPER}`;
  return (
    <div className="glass rounded-3xl p-5 shadow-soft w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Toby Swapper</h3>
        <a className="text-sm link" href={href} target="_blank" rel="noopener noreferrer">View Contract ↗</a>
      </div>
      <p className="text-sm text-inkSub">
        Routes swaps on Base and buys-&-burns <span className="font-semibold">$TOBY</span> with a 1% fee.
      </p>
      <div className="text-xs text-inkSub mt-3">Address</div>
      <div className="font-mono">{SWAPPER}</div>
    </div>
  );
}

function LinkPanel({ href, title, blurb, icon }: { href: string; title: string; blurb: string; icon: string }) {
  return (
    <div className="glass rounded-3xl p-5 shadow-soft w-full">
      <div className="flex items-center gap-3 mb-2.5">
        <span className="relative inline-block w-10 h-10 rounded-full overflow-hidden">
          <Image src={icon} alt={title} fill sizes="40px" className="object-cover" />
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-[var(--ink-sub)] mb-4">{blurb}</p>
      <a className="pill pill-opaque" href={href} target="_blank" rel="noopener noreferrer">Open ↗</a>
    </div>
  );
}

/* ---------- Carousel (window with peeking neighbors) ---------- */
export default function InfoCarousel() {
  const items = ITEMS;
  const [index, setIndex] = useState(0);
  const count = items.length;

  const clampIndex = useCallback((i: number) => (i + count) % count, [count]);
  const prev = useCallback(() => setIndex((i) => clampIndex(i - 1)), [clampIndex]);
  const next = useCallback(() => setIndex((i) => clampIndex(i + 1)), [clampIndex]);

  // swipe support
  const startX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => (startX.current = e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 40) (dx > 0 ? prev() : next());
    startX.current = null;
  };

  // keyboard arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  const Card = useCallback(({ item }: { item: Item }) => {
    if (item.kind === "token") {
      return <TokenPanel address={item.address} title={item.title} icon={item.icon} />;
    }
    if (item.kind === "swapper") {
      return <SwapperPanel />;
    }
    return <LinkPanel href={item.href} title={item.title} blurb={item.blurb} icon={item.icon} />;
  }, []);

  // neighbors (prev / next) indices
  const leftIdx  = clampIndex(index - 1);
  const rightIdx = clampIndex(index + 1);

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-[520px] relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-semibold">Explore TobyWorld</h3>
          <div className="pill pill-nav text-xs">{items[index].title}</div>
        </div>

        {/* Window */}
        <div
          className="relative overflow-visible select-none"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* track: center card full, neighbors peek at sides */}
          <div className="flex items-stretch gap-4">
            {/* left peek */}
            <div className="w-[16%] opacity-60 pointer-events-none">
              <div className="glass rounded-2xl p-3">
                <Mini item={items[leftIdx]} />
              </div>
            </div>

            {/* center (active) */}
            <div className="flex-1">
              <Card item={items[index]} />
            </div>

            {/* right peek */}
            <div className="w-[16%] opacity-60 pointer-events-none">
              <div className="glass rounded-2xl p-3">
                <Mini item={items[rightIdx]} />
              </div>
            </div>
          </div>

          {/* arrows */}
          <button
            type="button"
            onClick={prev}
            className="absolute left-1 -translate-y-1/2 top-1/2 pill pill-opaque px-3"
            aria-label="Previous"
          >
            ←
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-1 -translate-y-1/2 top-1/2 pill pill-opaque px-3"
            aria-label="Next"
          >
            →
          </button>
        </div>

        {/* dots */}
        <div className="mt-3 flex gap-2 justify-center">
          {items.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2.5 w-2.5 rounded-full ${i === index ? "bg-[var(--accent)]" : "bg-white/20"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* Tiny preview used for peeking neighbors */
function Mini({ item }: { item: Item }) {
  if (item.kind === "link") {
    return (
      <div className="flex items-center gap-2">
        <span className="relative inline-block w-7 h-7 rounded-lg overflow-hidden">
          <Image src={item.icon} alt={item.title} fill sizes="28px" className="object-cover" />
        </span>
        <span className="text-xs font-medium">{item.title}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="relative inline-block w-7 h-7 rounded-lg overflow-hidden">
        <Image src={item.icon} alt={item.title} fill sizes="28px" className="object-cover" />
      </span>
      <span className="text-xs font-medium">{item.title}</span>
    </div>
  );
}
