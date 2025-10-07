"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Address, formatUnits } from "viem";
import { base } from "viem/chains";
import { useReadContracts } from "wagmi";
import { TOBY, PATIENCE, TABOSHI, SWAPPER } from "@/lib/addresses";

/* ---------- ABIs ---------- */
const erc20Abi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

type Item =
  | { kind: "token"; title: string; icon: string; address: Address }
  | { kind: "swapper"; title: string; icon: string; address: Address }
  | { kind: "link"; title: string; icon: string; href: string; blurb: string };

const ITEMS: Item[] = [
  { kind: "token", title: "TOBY", icon: "/tokens/toby.PNG", address: TOBY },
  { kind: "token", title: "PATIENCE", icon: "/tokens/patience.PNG", address: PATIENCE },
  { kind: "token", title: "TABOSHI", icon: "/tokens/taboshi.PNG", address: TABOSHI },
  { kind: "swapper", title: "SWAPPER", icon: "/toby2.PNG", address: SWAPPER },
  { kind: "link", title: "toadgod.xyz", icon: "/tobyworld.PNG", href: "https://toadgod.xyz", blurb: "Official site: lore, links, and updates." },
  { kind: "link", title: "Telegram", icon: "/toadlore.PNG", href: "https://t.me/toadgang/212753", blurb: "Join Toadgang — community chat & alpha." },
  { kind: "link", title: "@toadgod1017", icon: "/twitter.PNG", href: "https://x.com/toadgod1017?s=21", blurb: "Follow on X for drops & news." },
];

/* ---------- Helpers ---------- */
function fmt(n?: number, max = 4) {
  if (n === undefined || !isFinite(n)) return "—";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
}

/* ---------- Panels ---------- */
function TokenPanel({ address, title, icon }: { address: Address; title: string; icon: string }) {
  const { data, isLoading } = useReadContracts({
    allowFailure: true,
    contracts: [
      { address, abi: erc20Abi, functionName: "name", chainId: base.id },
      { address, abi: erc20Abi, functionName: "symbol", chainId: base.id },
      { address, abi: erc20Abi, functionName: "decimals", chainId: base.id },
      { address, abi: erc20Abi, functionName: "totalSupply", chainId: base.id },
    ],
  });

  const name = data?.[0]?.result as string | undefined;
  const symbol = data?.[1]?.result as string | undefined;
  const decimals = (data?.[2]?.result as number | undefined) ?? 18;
  const supplyBig = data?.[3]?.result as bigint | undefined;
  const supply = supplyBig ? Number(formatUnits(supplyBig, decimals)) : undefined;

  const [holders, setHolders] = useState<number | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/holders?address=${address}`);
        if (r.ok) {
          const { holders } = await r.json();
          setHolders(typeof holders === "number" ? holders : null);
        } else setHolders(null);
      } catch {
        setHolders(null);
      }
    })();
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
        <div><div className="text-[var(--ink-sub)]">Holders</div><div>{holders === null ? "—" : fmt(holders, 0)}</div></div>
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
      <p className="text-[var(--ink-sub)]">Routes swaps on Base and buys-&-burns <span className="font-semibold">$TOBY</span> with a 1% fee.</p>
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

/* ---------- Scroll Gallery ---------- */
export default function InfoCarousel() {
  const [index, setIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(true);
  const active = ITEMS[index];

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const scrollIndex = Math.round(el.scrollLeft / el.clientWidth);
    if (scrollIndex !== index) {
      setIndex(scrollIndex);
      setShowInfo(false);
      setTimeout(() => setShowInfo(true), 150);
    }
  };

  return (
    <div className="flex flex-col items-center w-full overflow-hidden">
      {/* Horizontal scroll of images */}
      <div
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar w-full max-w-[420px]"
        onScroll={onScroll}
      >
        {ITEMS.map((item, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-full snap-center flex flex-col items-center px-4"
          >
            <div className="rounded-3xl overflow-hidden glass shadow-soft aspect-square w-full max-w-[320px] mx-auto">
              <Image
                src={item.icon}
                alt={item.title}
                width={320}
                height={320}
                className="object-contain"
              />
            </div>
            <h3 className="text-lg font-semibold mt-3">{item.title}</h3>
          </div>
        ))}
      </div>

      {/* Info section */}
      <div className="mt-5 transition-all duration-300 ease-in-out w-full flex justify-center px-3">
        {showInfo && (
          <div className="w-full max-w-[420px]">
            {active.kind === "token" ? (
              <TokenPanel address={active.address} title={active.title} icon={active.icon} />
            ) : active.kind === "swapper" ? (
              <SwapperPanel />
            ) : (
              <LinkPanel href={active.href} title={active.title} blurb={active.blurb} icon={active.icon} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
