// app/about/page.tsx
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Address, formatUnits } from "viem";
import { base } from "viem/chains";
import { useReadContract, useReadContracts } from "wagmi";

import { TOBY, PATIENCE, TABOSHI, USDC, WETH, SWAPPER, DEAD } from "@/lib/addresses";
import { useUsdPriceSingle } from "@/lib/prices";

/** ──────────────────────────────────────────────────────────────────────────
 * Small client components so we can read on-chain (like BaseScan does).
 * We avoid third-party APIs and pull data directly with wagmi/viem.
 * ────────────────────────────────────────────────────────────────────────── */

const erc20Abi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const swapperAbi = [
  { type: "function", name: "totalTobyBurned", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

function fmt(n?: number, max = 4) {
  if (n === undefined || !isFinite(n)) return "—";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
}

function CardShell({ children, title, href, iconSrc }: { children: React.ReactNode; title: string; href: string; iconSrc: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="glass rounded-3xl p-5 shadow-soft block group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="relative inline-block w-8 h-8 rounded-full overflow-hidden">
            <Image src={iconSrc} alt={title} fill sizes="32px" className="object-cover" />
          </span>
          <h3 className="font-semibold group-hover:text-accent">{title}</h3>
        </div>
        <span className="pill pill-opaque text-xs">View on BaseScan ↗</span>
      </div>
      {children}
    </a>
  );
}

function TokenInfoCard({
  address,
  icon,
  titleOverride,
}: {
  address: Address;
  icon: string;
  titleOverride?: string;
}) {
  // Batch read: name, symbol, decimals, totalSupply
  const { data } = useReadContracts({
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
  const totalSupplyBig = data?.[3]?.result as bigint | undefined;
  const totalSupply = totalSupplyBig ? Number(formatUnits(totalSupplyBig, decimals)) : undefined;

  const usd = useUsdPriceSingle(address);
  const href = `https://basescan.org/address/${address}`;

  return (
    <CardShell title={titleOverride ?? symbol ?? "Token"} href={href} iconSrc={icon}>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <div className="text-inkSub">Name</div>
          <div className="font-mono">{name ?? "—"}</div>
        </div>
        <div className="space-y-1">
          <div className="text-inkSub">Symbol</div>
          <div className="font-mono">{symbol ?? "—"}</div>
        </div>
        <div className="space-y-1">
          <div className="text-inkSub">Total Supply</div>
          <div className="font-mono">{fmt(totalSupply)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-inkSub">Spot (USDC)</div>
          <div className="font-mono">${usd ? usd.toFixed(6) : "—"}</div>
        </div>
      </div>
    </CardShell>
  );
}

function SwapperCard() {
  const burned = useReadContract({
    address: SWAPPER,
    abi: swapperAbi,
    functionName: "totalTobyBurned",
    chainId: base.id,
    query: { refetchInterval: 20_000, staleTime: 10_000 },
  });

  // Helpful: show DEAD balance of $TOBY as an extra burn signal
  const tobyDead = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: TOBY, abi: erc20Abi, functionName: "decimals", chainId: base.id },
      { address: TOBY, abi: erc20Abi, functionName: "balanceOf", args: [DEAD], chainId: base.id },
    ],
  });

  const burnedNum = (() => {
    const v = burned.data as bigint | undefined;
    if (!v) return undefined;
    return Number(formatUnits(v, 18));
  })();

  const dec = (tobyDead.data?.[0]?.result as number | undefined) ?? 18;
  const deadBal = tobyDead.data?.[1]?.result as bigint | undefined;
  const deadBalNum = deadBal ? Number(formatUnits(deadBal, dec)) : undefined;

  const href = `https://basescan.org/address/${SWAPPER}`;
  const deadHref = `https://basescan.org/address/${DEAD}`;

  return (
    <CardShell title="Toby Swapper" href={href} iconSrc="/tobyswapper.PNG">
      <p className="text-sm text-inkSub mb-4">
        Routes swaps on Base and sends a 1% fee to market-buy <span className="font-semibold">$TOBY</span>, then burns it forever.
      </p>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <div className="text-inkSub">Total $TOBY Burned</div>
          <div className="font-mono">{fmt(burnedNum)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-inkSub">DEAD Wallet $TOBY</div>
          <Link href={deadHref} target="_blank" className="font-mono underline">
            {fmt(deadBalNum)}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <a className="pill pill-opaque text-xs" href={href} target="_blank" rel="noopener noreferrer">
          View Contract ↗
        </a>
        <a className="pill pill-opaque text-xs" href={`${href}#code`} target="_blank" rel="noopener noreferrer">
          Verified Source ↗
        </a>
      </div>
    </CardShell>
  );
}

/** ──────────────────────────────────────────────────────────────────────────
 * PAGE
 * ────────────────────────────────────────────────────────────────────────── */
export default function AboutPage() {
  const pills = [
    "Base-native swapping, Toby style",
    "1% fee auto-buys $TOBY → burn",
    "Dark glass + playful color pips",
    "USDC / WETH ↔ TOBY · PATIENCE · TABOSHI",
    "On-chain reads (same data as BaseScan)",
    "Open-source front-end; verified contracts",
  ];

  const items: { address: Address; icon: string; title?: string }[] = [
    { address: TOBY, icon: "/tokens/toby.PNG", title: "TOBY" },
    { address: PATIENCE, icon: "/tokens/patience.PNG", title: "PATIENCE" },
    { address: TABOSHI, icon: "/tokens/taboshi.PNG", title: "TABOSHI" },
    { address: USDC, icon: "/tokens/usdc.PNG", title: "USDC" },
    { address: WETH, icon: "/tokens/weth.PNG", title: "WETH" },
  ];

  return (
    <section className="space-y-8">
      {/* Header + pills */}
      <div>
        <h1 className="text-3xl font-bold mb-4">About TobySwap</h1>
        <div className="flex flex-wrap gap-3">
          {pills.map((p) => (
            <span key={p} className="pill bg-[var(--glass)] text-sm">
              {p}
            </span>
          ))}
        </div>
        <p className="text-inkSub mt-4">
          This UI calls the Toby Swapper contract on Base and constructs paths that buy-burn <span className="font-semibold">$TOBY</span> using the
          1% fee. Data below is read on-chain (the same core fields BaseScan displays) and links you to the verified contracts.
        </p>
      </div>

      {/* Swapper */}
      <Suspense fallback={<div className="glass rounded-3xl p-6">Loading Swapper…</div>}>
        <SwapperCard />
      </Suspense>

      {/* Tokens grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {items.map((t) => (
          <Suspense key={t.address} fallback={<div className="glass rounded-3xl p-6">Loading {t.title}…</div>}>
            <TokenInfoCard address={t.address} icon={t.icon} titleOverride={t.title} />
          </Suspense>
        ))}
      </div>

      {/* Community / links row (mirrors home) */}
      <div className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="font-semibold mb-4">Quick Links</h3>
        <div className="flex flex-wrap gap-3">
          <a className="pill" href="https://tobyswap.vercel.app" target="_blank" rel="noopener noreferrer">
            App Home
          </a>
          <a className="pill" href={`https://basescan.org/address/${SWAPPER}`} target="_blank" rel="noopener noreferrer">
            Swapper on BaseScan
          </a>
          <a className="pill" href={`https://basescan.org/address/${TOBY}`} target="_blank" rel="noopener noreferrer">
            $TOBY Token
          </a>
          <a className="pill" href={`https://basescan.org/address/${PATIENCE}`} target="_blank" rel="noopener noreferrer">
            PATIENCE Token
          </a>
          <a className="pill" href={`https://basescan.org/address/${TABOSHI}`} target="_blank" rel="noopener noreferrer">
            TABOSHI Token
          </a>
          <a className="pill" href={`https://basescan.org/address/${USDC}`} target="_blank" rel="noopener noreferrer">
            USDC on Base
          </a>
          <a className="pill" href={`https://basescan.org/address/${WETH}`} target="_blank" rel="noopener noreferrer">
            WETH on Base
          </a>
          <a className="pill" href={`https://basescan.org/address/${DEAD}`} target="_blank" rel="noopener noreferrer">
            DEAD Burn Wallet
          </a>
        </div>
      </div>
    </section>
  );
}
