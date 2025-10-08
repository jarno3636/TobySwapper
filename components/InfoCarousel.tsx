// components/InfoCarousel.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  | { kind: "token"; title: string; icon: string; address: Address }
  | { kind: "swapper"; title: string; icon: string; address: Address }
  | { kind: "link"; title: string; icon: string; href: string; blurb: string };

const ITEMS: Item[] = [
  { kind: "token", title: "TOBY",     icon: "/tokens/toby.PNG",     address: TOBY },
  { kind: "token", title: "PATIENCE", icon: "/tokens/patience.PNG", address: PATIENCE },
  { kind: "token", title: "TABOSHI",  icon: "/tokens/taboshi.PNG",  address: TABOSHI },
  { kind: "swapper", title: "SWAPPER", icon: "/toby2.PNG",          address: SWAPPER },
  { kind: "link", title: "toadgod.xyz", icon: "/tobyworld.PNG", href: "https://toadgod.xyz", blurb: "Official site: lore, links, and updates." },
  { kind: "link", title: "Telegram", icon: "/toadlore.PNG", href: "https://t.me/toadgang/212753", blurb: "Join Toadgang — community chat & alpha." },
  { kind: "link", title: "@toadgod1017", icon: "/twitter.PNG", href: "https://x.com/toadgod1017?s=21", blurb: "Follow on X for drops & news." },
];

/* ---------- Utils ---------- */
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
    query: { refetchOnWindowFocus: false, staleTime: 30_000, gcTime: 120_000 },
  });

  const name = data?.[0]?.result as string | undefined;
  const symbol = data?.[1]?.result as string | undefined;
  const decimals = (data?.[2]?.result as number | undefined) ?? 18;
  const supplyBig = data?.[3]?.result as bigint | undefined;
  const supply = supplyBig ? Number(formatUnits(supplyBig, decimals)) : undefined;

  // Holders (robust): single load with timeout + abort + stable cache (via /api/holders)
  const [holders, setHolders] = useState<number | null>(null);
  const [holdersLoaded, setHoldersLoaded] = useState(false);

  useEffect(() => {
    let aborted = false;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000); // 10s timeout

    (async () => {
      try {
        const res = await fetch(`/api/holders?address=${address}`, {
          signal: ac.signal,
          cache: "force-cache",
        });
        if (!res.ok) throw new Error(`http ${res.status}`);
        const json = await res.json();
        if (!aborted) {
          setHolders(typeof json?.holders === "number" ? json.holders : null);
          setHoldersLoaded(true);
        }
      } catch {
        if (!aborted) {
          setHolders(null);
          setHoldersLoaded(true);
        }
      }
    })();

    return () => {
      aborted = true;
      clearTimeout(timer);
      ac.abort();
    };
  }, [address]);

  const href = `https://basescan.org/address/${address}`;

  return (
    <div className="glass rounded-3xl p-5 shadow-soft w-full max-w-[420px] mx-auto text-sm">
      <div className="flex items-center gap-3 mb-3">
        <Image src={icon} alt={title} width={40} height={40} className="rounded-full" />
        <div>
          <h3 className="font-semibold">{title}</h3>
          <a href={href} className="link text-xs" target="_blank" rel="noreferrer">View on BaseScan ↗</a>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><div className="text-[var(--ink-sub)]">Name</div><div>{isLoading ? "…" : name ?? "—"}</div></div>
        <div><div className="text-[var(--ink-sub)]">Symbol</div><div>{isLoading ? "…" : symbol ?? "—"}</div></div>
        <div><div className="text-[var(--ink-sub)]">Total Supply</div><div>{fmt(supply)}</div></div>
        <div>
          <div className="text-[var(--ink-sub)]">Holders</div>
          <div>{holdersLoaded ? (holders === null ? "—" : fmt(holders, 0)) : "…"}</div>
        </div>
      </div>
    </div>
  );
}

function SwapperPanel() {
  const href = `https://basescan.org/address/${SWAPPER}`;
  return (
    <div className="glass rounded-3xl p-5 shadow-soft w-full max-w-[420px] mx-auto text-sm">
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
    <div className="glass rounded-3xl p-5 shadow-soft w-full max-w-[420px] mx-auto text-sm">
      <div className="flex items-center gap-3 mb-2">
        <Image src={icon} alt={title} width={40} height={40} className="rounded-full" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-[var(--ink-sub)] mb-3">{blurb}</p>
      <a className="pill pill-opaque text-center" href={href} target="_blank" rel="noreferrer">Open ↗</a>
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

  useEffect(() => {
    const t = setTimeout(() => setAnimating(false), 300);
    return () => clearTimeout(t);
  }, [index]);

  const active = ITEMS[index];
  const leftIdx = (index - 1 + ITEMS.length) % ITEMS.length;
  const rightIdx = (index + 1) % ITEMS.length;

  return (
    <div className="flex flex-col items-center w-full overflow-hidden">
      {/* Window with peeking neighbors (fully mobile-safe) */}
      <div className="relative flex items-center justify-center w-full max-w-[520px]">
        <button
          onClick={prev}
          className="absolute left-0 z-10 pill pill-opaque text-lg px-3 py-1"
          aria-label="Previous"
        >
          ←
        </button>

        <div className="w-full px-10">
          <div className="flex items-stretch gap-4">
            {/* left peek */}
            <div className="w-[16%] opacity-60 pointer-events-none">
              <div className="glass rounded-2xl p-2 flex items-center justify-center">
                <Mini item={ITEMS[leftIdx]} />
              </div>
            </div>

            {/* center card image window */}
            <div className="flex-1 flex items-center justify-center">
              <div className="w-[50%] aspect-square glass rounded-3xl overflow-hidden shadow-soft flex items-center justify-center">
                <Image
                  src={active.icon}
                  alt={active.title}
                  width={180}
                  height={180}
                  className="object-contain"
                />
              </div>
            </div>

            {/* right peek */}
            <div className="w-[16%] opacity-60 pointer-events-none">
              <div className="glass rounded-2xl p-2 flex items-center justify-center">
                <Mini item={ITEMS[rightIdx]} />
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={next}
          className="absolute right-0 z-10 pill pill-opaque text-lg px-3 py-1"
          aria-label="Next"
        >
          →
        </button>
      </div>

      <h3 className="text-lg font-semibold mt-3">{active.title}</h3>

      {/* Info section with slide-up animation */}
      <div
        className={`mt-5 w-full flex justify-center px-3 transition-all duration-500 transform ${
          animating ? "opacity-0 translate-y-6" : "opacity-100 translate-y-0"
        }`}
      >
        <div className="w-full max-w-[420px]">
          {active.kind === "token" ? (
            <TokenPanel address={active.address as Address} title={active.title} icon={active.icon} />
          ) : active.kind === "swapper" ? (
            <SwapperPanel />
          ) : (
            <LinkPanel href={(active as any).href} title={active.title} blurb={(active as any).blurb} icon={active.icon} />
          )}
        </div>
      </div>

      {/* Dots */}
      <div className="mt-3 flex gap-2 justify-center">
        {ITEMS.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-2.5 w-2.5 rounded-full ${i === index ? "bg-[var(--accent)]" : "bg-white/20"}`}
          />
        ))}
      </div>
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
