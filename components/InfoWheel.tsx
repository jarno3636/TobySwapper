"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Address, formatUnits } from "viem";
import { base } from "viem/chains";
import { useReadContracts } from "wagmi";
import { TOBY, PATIENCE, TABOSHI, USDC, WETH, DEAD } from "@/lib/addresses";

/** Minimal ERC20 ABI */
const erc20Abi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

type WheelItem =
  | { kind: "token"; title: string; icon: string; address: Address }
  | { kind: "link"; title: string; icon: string; href: string; blurb: string };

const ITEMS: WheelItem[] = [
  { kind: "token", title: "TOBY",     icon: "/tokens/toby.PNG",     address: TOBY },
  { kind: "token", title: "PATIENCE", icon: "/tokens/patience.PNG", address: PATIENCE },
  { kind: "token", title: "TABOSHI",  icon: "/tokens/taboshi.PNG",  address: TABOSHI },
  { kind: "token", title: "USDC",     icon: "/tokens/usdc.PNG",     address: USDC },
  { kind: "token", title: "WETH",     icon: "/tokens/weth.PNG",     address: WETH },

  { kind: "link",  title: "toadgod.xyz", icon: "/toby2.PNG", href: "https://toadgod.xyz",
    blurb: "Official site: lore, links, and updates." },

  { kind: "link",  title: "Telegram", icon: "/toby2.PNG",
    href: "https://t.me/toadgang/212753",
    blurb: "Join Toadgang — community chat & alpha." },

  { kind: "link",  title: "@toadgod1017", icon: "/toby2.PNG",
    href: "https://x.com/toadgod1017?s=21",
    blurb: "Follow on X for drops & news." },
];

function fmt(n?: number, max = 4) {
  if (n === undefined || !isFinite(n)) return "—";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
}

function TokenPanel({ address, title, icon }: { address: Address; title: string; icon: string }) {
  const { data, isLoading } = useReadContracts({
    allowFailure: true,
    contracts: [
      { address, abi: erc20Abi, functionName: "name",        chainId: base.id },
      { address, abi: erc20Abi, functionName: "symbol",      chainId: base.id },
      { address, abi: erc20Abi, functionName: "decimals",    chainId: base.id },
      { address, abi: erc20Abi, functionName: "totalSupply", chainId: base.id },
      // optionally show DEAD wallet holdings as a fun stat
      { address, abi: erc20Abi, functionName: "balanceOf",   args: [DEAD], chainId: base.id },
    ],
    query: { refetchOnWindowFocus: false, staleTime: 15_000, gcTime: 60_000 },
  });

  const name = data?.[0]?.result as string | undefined;
  const symbol = data?.[1]?.result as string | undefined;
  const decimals = (data?.[2]?.result as number | undefined) ?? 18;
  const supplyBig = data?.[3]?.result as bigint | undefined;
  const deadBal = data?.[4]?.result as bigint | undefined;

  const supply = supplyBig ? Number(formatUnits(supplyBig, decimals)) : undefined;
  const deadAmt = deadBal ? Number(formatUnits(deadBal, decimals)) : undefined;
  const href = `https://basescan.org/address/${address}`;

  return (
    <div className="glass rounded-3xl p-5 shadow-soft">
      <div className="flex items-center gap-3 mb-4">
        <span className="relative inline-block w-10 h-10 rounded-full overflow-hidden">
          <Image src={icon} alt={title} fill sizes="40px" className="object-cover" />
        </span>
        <div>
          <h3 className="font-semibold leading-tight">{title}</h3>
          <a className="text-sm link" href={href} target="_blank" rel="noopener noreferrer">View on BaseScan ↗</a>
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
          <div className="text-[var(--ink-sub)]">DEAD Wallet</div>
          <div className="font-mono">{isLoading ? "…" : fmt(deadAmt)}</div>
        </div>
      </div>
    </div>
  );
}

function LinkPanel({ href, title, blurb, icon }: { href: string; title: string; blurb: string; icon: string }) {
  return (
    <div className="glass rounded-3xl p-5 shadow-soft">
      <div className="flex items-center gap-3 mb-3">
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

export default function InfoWheel() {
  const [active, setActive] = useState(ITEMS[0]); // default to first slice
  const slices = useMemo(() => ITEMS.length, []);
  const radius = 120; // px from center for icons

  return (
    <div className="grid md:grid-cols-2 gap-8 items-start">
      {/* WHEEL */}
      <div className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="font-semibold mb-4">Explore TobyWorld</h3>
        <div className="relative mx-auto" style={{ width: 320, height: 320 }}>
          {/* center node */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="text-xs text-[var(--ink-sub)] mb-1">Selected</div>
            <div className="pill pill-nav">{active.title}</div>
          </div>

          {/* slices as orbiting icons */}
          {ITEMS.map((item, i) => {
            const angle = (i / slices) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            return (
              <button
                key={i}
                type="button"
                onClick={() => setActive(item)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-2 glass-hover
                  ${active === item ? "ring-2 ring-[var(--accent)]" : ""}`}
                style={{ left: 160 + x, top: 160 + y }}
                aria-pressed={active === item}
                aria-label={item.title}
              >
                <span className="relative inline-block w-14 h-14 rounded-2xl overflow-hidden glass">
                  <Image
                    src={item.kind === "token" ? (item as any).icon : item.icon}
                    alt={item.title}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </span>
              </button>
            );
          })}
        </div>

        {/* Mobile fallback: horizontal scroll list */}
        <div className="mt-4 flex md:hidden gap-2 overflow-x-auto no-scrollbar">
          {ITEMS.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(item)}
              className={`pill ${active === item ? "pill-nav" : "pill-opaque"}`}
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>

      {/* DETAILS PANEL */}
      <div className="space-y-4">
        {active.kind === "token" ? (
          <TokenPanel
            address={(active as Extract<WheelItem,{kind:"token"}>).address}
            title={active.title}
            icon={active.icon}
          />
        ) : (
          <LinkPanel
            href={(active as Extract<WheelItem,{kind:"link"}>).href}
            title={active.title}
            blurb={(active as Extract<WheelItem,{kind:"link"}>).blurb}
            icon={active.icon}
          />
        )}
      </div>
    </div>
  );
}
