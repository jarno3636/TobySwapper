"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { Address, formatUnits } from "viem";
import { base } from "viem/chains";
import { useReadContract, useReadContracts } from "wagmi";
import { TOBY, PATIENCE, TABOSHI, DEAD, SWAPPER } from "@/lib/addresses";

/** Minimal ERC20 ABI */
const erc20Abi = [
  { type: "function", name: "name",        stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol",      stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals",    stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf",   stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const swapperAbi = [
  { type: "function", name: "totalTobyBurned", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

type WheelItem =
  | { kind: "token"; title: string; icon: string; address: Address }
  | { kind: "swapper"; title: string; icon: string; address: Address }
  | { kind: "link";  title: string; icon: string; href: string; blurb: string };

const ITEMS: WheelItem[] = [
  { kind: "token",   title: "TOBY",     icon: "/tokens/toby.PNG",     address: TOBY },
  { kind: "token",   title: "PATIENCE", icon: "/tokens/patience.PNG", address: PATIENCE },
  { kind: "token",   title: "TABOSHI",  icon: "/tokens/taboshi.PNG",  address: TABOSHI },
  { kind: "swapper", title: "SWAPPER",  icon: "/toby2.PNG",           address: SWAPPER },
  { kind: "link",    title: "toadgod.xyz",  icon: "/toby2.PNG", href: "https://toadgod.xyz",
    blurb: "Official site: lore, links, and updates." },
  { kind: "link",    title: "Telegram",     icon: "/toby2.PNG", href: "https://t.me/toadgang/212753",
    blurb: "Join Toadgang — community chat & alpha." },
  { kind: "link",    title: "@toadgod1017", icon: "/toby2.PNG", href: "https://x.com/toadgod1017?s=21",
    blurb: "Follow on X for drops & news." },
];

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
      { address, abi: erc20Abi, functionName: "balanceOf",   args: [DEAD], chainId: base.id },
    ],
    query: { refetchOnWindowFocus: false, staleTime: 15_000, gcTime: 60_000 },
  });

  const name = data?.[0]?.result as string | undefined;
  const symbol = data?.[1]?.result as string | undefined;
  const decimals = (data?.[2]?.result as number | undefined) ?? 18;
  const supplyBig = data?.[3]?.result as bigint | undefined;
  const deadBal   = data?.[4]?.result as bigint | undefined;

  const supply = supplyBig ? Number(formatUnits(supplyBig, decimals)) : undefined;
  const deadAmt = deadBal ? Number(formatUnits(deadBal, decimals)) : undefined;
  const href = `https://basescan.org/address/${address}`;

  return (
    <div className="glass rounded-3xl p-5 shadow-soft hover-glow w-full">
      <div className="flex items-center gap-3 mb-4">
        <span className="relative inline-block w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden">
          <Image src={icon} alt={title} fill sizes="40px" className="object-cover" />
        </span>
        <div>
          <h3 className="font-semibold leading-tight">{title}</h3>
          <a className="text-sm link" href={href} target="_blank" rel="noopener noreferrer">View on BaseScan ↗</a>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><div className="text-[var(--ink-sub)]">Name</div><div className="font-mono">{isLoading ? "…" : name ?? "—"}</div></div>
        <div><div className="text-[var(--ink-sub)]">Symbol</div><div className="font-mono">{isLoading ? "…" : symbol ?? "—"}</div></div>
        <div><div className="text-[var(--ink-sub)]">Total Supply</div><div className="font-mono">{isLoading ? "…" : fmt(supply)}</div></div>
        <div><div className="text-[var(--ink-sub)]">DEAD Wallet</div><div className="font-mono">{isLoading ? "…" : fmt(deadAmt)}</div></div>
      </div>
    </div>
  );
}

function SwapperPanel() {
  const burned = useReadContract({
    address: SWAPPER,
    abi: swapperAbi,
    functionName: "totalTobyBurned",
    chainId: base.id,
    query: { refetchInterval: 20_000, staleTime: 10_000, refetchOnWindowFocus: false },
  });

  const burnedNum = (() => {
    const v = burned.data as bigint | undefined;
    if (!v) return undefined;
    return Number(formatUnits(v, 18));
  })();

  const href = `https://basescan.org/address/${SWAPPER}`;

  return (
    <div className="glass rounded-3xl p-5 shadow-soft hover-glow w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Toby Swapper</h3>
        <a className="text-sm link" href={href} target="_blank" rel="noopener noreferrer">View Contract ↗</a>
      </div>
      <p className="text-sm text-inkSub mb-3">
        Routes swaps on Base and buys-&-burns <span className="font-semibold">$TOBY</span> with a 1% fee.
      </p>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><div className="text-[var(--ink-sub)]">Total $TOBY Burned</div><div className="font-mono">{fmt(burnedNum)}</div></div>
        <div><div className="text-[var(--ink-sub)]">Address</div><div className="font-mono truncate">{SWAPPER.slice(0,6)}…{SWAPPER.slice(-4)}</div></div>
      </div>
    </div>
  );
}

function LinkPanel({ href, title, blurb, icon }: { href: string; title: string; blurb: string; icon: string }) {
  return (
    <div className="glass rounded-3xl p-5 shadow-soft hover-glow w-full">
      <div className="flex items-center gap-3 mb-3">
        <span className="relative inline-block w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden">
          <Image src={icon} alt={title} fill sizes="40px" className="object-cover" />
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-[var(--ink-sub)] mb-4">{blurb}</p>
      <a className="pill pill-opaque" href={href} target="_blank" rel="noopener noreferrer">Open ↗</a>
    </div>
  );
}

/* ---------- Wheel ---------- */
export default function InfoWheel() {
  const items = ITEMS;
  const count = items.length;
  const step = 360 / count;

  // Smaller for phones: clamp(200px, vw - 56px, 280px)
  const size = useResponsiveWheelSize();
  const radius = Math.max(76, Math.floor(size * 0.34));

  // rotationDeg: 0 => item 0 at top. Positive clockwise.
  const [rotationDeg, setRotationDeg] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  // drag state
  const dragging = useRef(false);
  const centerRef = useRef<HTMLDivElement | null>(null);
  const lastAngleRef = useRef<number | null>(null);

  // --- math helpers
  const normalizeDeg = (d: number) => {
    let x = d % 360;
    if (x > 180) x -= 360;
    if (x < -180) x += 360;
    return x;
  };
  const mod = (n: number, m: number) => ((n % m) + m) % m;
  const shortestRotation = (current: number, target: number) => {
    const c = normalizeDeg(current);
    let t = normalizeDeg(target);
    let diff = t - c;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return c + diff;
  };

  // snap & select (single source of truth to avoid “weirdness”)
  const snapToIndex = (i: number) => {
    const exact = -i * step;
    setActiveIndex(i);
    // animate near current, then snap to exact angle for perfect alignment
    const adj = shortestRotation(rotationDeg, exact);
    setRotationDeg(adj);
    setTimeout(() => setRotationDeg(exact), 200);
  };

  // click a slice → bring to top AND select (one tap)
  const handleSelect = (i: number) => snapToIndex(i);

  // drag helpers
  const angleFromEvent = (e: PointerEvent | TouchEvent | MouseEvent) => {
    const el = centerRef.current!;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let clientX = 0, clientY = 0;
    if ("touches" in e && e.touches.length) {
      clientX = e.touches[0].clientX; clientY = e.touches[0].clientY;
    } else if ("clientX" in e) {
      clientX = (e as MouseEvent).clientX; clientY = (e as MouseEvent).clientY;
    }
    const rad = Math.atan2(clientY - cy, clientX - cx);
    let deg = (rad * 180) / Math.PI;
    deg -= 90; // 0° at top
    return deg;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    lastAngleRef.current = angleFromEvent(e.nativeEvent);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const current = angleFromEvent(e.nativeEvent);
    const last = lastAngleRef.current ?? current;
    const delta = current - last;
    setRotationDeg((r) => r + delta);
    lastAngleRef.current = current;
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    lastAngleRef.current = null;

    // compute nearest index at top from current rotation, then snap+select
    const normalized = normalizeDeg(rotationDeg);
    let k = Math.round(-normalized / step);
    k = mod(k, count);
    snapToIndex(k);
  };

  const active = items[activeIndex];

  return (
    <div className="grid md:grid-cols-2 gap-6 items-start w-full">
      {/* WHEEL CARD */}
      <div
        className="glass rounded-3xl p-5 sm:p-6 shadow-soft hover-glow w-full"
        style={{ maxWidth: "min(520px, 100%)" }}
      >
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="font-semibold">Explore TobyWorld</h3>
          <div className="pill pill-nav text-xs">{active.title}</div>
        </div>

        <div className="relative mx-auto select-none" style={{ width: size, height: size }}>
          {/* Interaction surface */}
          <div
            ref={centerRef}
            className="absolute inset-0 rounded-full"
            style={{ touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />

          {/* Orbiting icons — group rotation */}
          <div
            className="absolute inset-0 transition-transform duration-200 ease-out"
            style={{ transform: `rotate(${rotationDeg}deg)`, transformOrigin: "50% 50%" }}
          >
            {items.map((item, i) => {
              const baseAngle = i * step;
              const angleRad = (baseAngle * Math.PI) / 180;
              const cx = size / 2 + radius * Math.cos(angleRad - Math.PI / 2);
              const cy = size / 2 + radius * Math.sin(angleRad - Math.PI / 2);
              const isActive = i === activeIndex;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelect(i)}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: cx, top: cy }}
                  aria-pressed={isActive}
                  aria-label={item.title}
                >
                  <span
                    className={`relative inline-block w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden glass transition-transform
                      ${isActive ? "ring-2 ring-[var(--accent)] scale-[1.06]" : "hover:scale-105"}`}
                  >
                    {/* counter-rotate so images stay upright */}
                    <span className="absolute inset-0" style={{ transform: `rotate(${-rotationDeg}deg)` }}>
                      <Image src={item.icon} alt={item.title} fill sizes="56px" className="object-cover" />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Top marker */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-0 h-0 border-l-3 border-r-3 border-b-6 border-transparent border-b-[var(--accent)] opacity-70 pointer-events-none" />
        </div>

        {/* Mobile quick picker */}
        <div className="mt-3 sm:mt-4 flex md:hidden gap-2 overflow-x-auto no-scrollbar">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(i)}
              className={`pill ${i === activeIndex ? "pill-nav" : "pill-opaque"} text-sm`}
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>

      {/* DETAILS */}
      <div className="space-y-4 w-full" style={{ maxWidth: "min(520px, 100%)" }}>
        {active.kind === "token" ? (
          <TokenPanel address={active.address as Address} title={active.title} icon={active.icon} />
        ) : active.kind === "swapper" ? (
          <SwapperPanel />
        ) : (
          <LinkPanel href={(active as any).href} title={active.title} blurb={(active as any).blurb} icon={active.icon} />
        )}
      </div>
    </div>
  );
}

/** clamp(200px, viewport-56px, 280px) */
function useResponsiveWheelSize() {
  const [w, setW] = useState(280);
  useEffect(() => {
    const compute = () => {
      const vw = typeof window !== "undefined" ? window.innerWidth : 360;
      const candidate = Math.min(280, Math.max(200, vw - 56)); // 28px padding each side
      setW(candidate);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return w;
}
