"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Address, formatUnits } from "viem";
import { base } from "viem/chains";
import { useReadContract, useReadContracts } from "wagmi";
import { TOBY, PATIENCE, TABOSHI, USDC, WETH, SWAPPER, DEAD } from "@/lib/addresses";
import { useUsdPriceSingle } from "@/lib/prices";

/** minimal ABIs */
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

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/10 rounded ${className}`} />;
}

function CardShell({
  children,
  title,
  href,
  iconSrc,
}: {
  children: React.ReactNode;
  title: string;
  href: string;
  iconSrc: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="glass rounded-3xl p-5 shadow-soft block group"
    >
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
  const { data, isLoading } = useReadContracts({
    allowFailure: true,
    contracts: [
      { address, abi: erc20Abi, functionName: "name", chainId: base.id },
      { address, abi: erc20Abi, functionName: "symbol", chainId: base.id },
      { address, abi: erc20Abi, functionName: "decimals", chainId: base.id },
      { address, abi: erc20Abi, functionName: "totalSupply", chainId: base.id },
    ],
    query: { refetchOnWindowFocus: false, staleTime: 10_000, gcTime: 60_000 },
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
          <div className="text-[var(--ink-sub)]">Name</div>
          <div className="font-mono">{isLoading ? <Skeleton className="h-4 w-24" /> : name ?? "—"}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[var(--ink-sub)]">Symbol</div>
          <div className="font-mono">{isLoading ? <Skeleton className="h-4 w-16" /> : symbol ?? "—"}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[var(--ink-sub)]">Total Supply</div>
          <div className="font-mono">{isLoading ? <Skeleton className="h-4 w-28" /> : fmt(totalSupply)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[var(--ink-sub)]">Spot (USDC)</div>
          <div className="font-mono">{usd ? `$${usd.toFixed(6)}` : <Skeleton className="h-4 w-24" />}</div>
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
    query: { refetchInterval: 20_000, staleTime: 10_000, refetchOnWindowFocus: false },
  });

  const deadReads = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: TOBY, abi: erc20Abi, functionName: "decimals", chainId: base.id },
      { address: TOBY, abi: erc20Abi, functionName: "balanceOf", args: [DEAD], chainId: base.id },
    ],
    query: { refetchOnWindowFocus: false, staleTime: 10_000 },
  });

  const burnedNum = (() => {
    const v = burned.data as bigint | undefined;
    if (!v) return undefined;
    return Number(formatUnits(v, 18));
  })();

  const dec = (deadReads.data?.[0]?.result as number | undefined) ?? 18;
  const deadBal = deadReads.data?.[1]?.result as bigint | undefined;
  const deadBalNum = deadBal ? Number(formatUnits(deadBal, dec)) : undefined;

  const href = `https://basescan.org/address/${SWAPPER}`;
  const deadHref = `https://basescan.org/address/${DEAD}`;

  const loading = burned.isLoading || deadReads.isLoading;

  return (
    <CardShell title="Toby Swapper" href={href} iconSrc="/tobyswapper.PNG">
      <p className="text-sm text-[var(--ink-sub)] mb-4">
        Routes swaps on Base and sends a 1% fee to market-buy <span className="font-semibold">$TOBY</span>, then burns it forever.
      </p>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <div className="text-[var(--ink-sub)]">Total $TOBY Burned</div>
          <div className="font-mono">{loading ? <Skeleton className="h-4 w-28" /> : fmt(burnedNum)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[var(--ink-sub)]">DEAD Wallet $TOBY</div>
          {loading ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <Link href={deadHref} target="_blank" className="font-mono underline">
              {fmt(deadBalNum)}
            </Link>
          )}
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

export default function AboutPage() {
  // Mount gate prevents first-paint crashes if providers/hooks momentarily mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const pills = useMemo(
    () => [
      "Base-native swapping, Toby style",
      "1% fee auto-buys $TOBY → burn",
      "Dark glass + playful color pips",
      "USDC / WETH ↔ TOBY · PATIENCE · TABOSHI",
      "On-chain reads (same data as BaseScan)",
      "Open-source front-end; verified contracts",
    ],
    []
  );

  const items: { address: Address; icon: string; title?: string }[] = useMemo(
    () => [
      { address: TOBY as Address, icon: "/tokens/toby.PNG", title: "TOBY" },
      { address: PATIENCE as Address, icon: "/tokens/patience.PNG", title: "PATIENCE" },
      { address: TABOSHI as Address, icon: "/tokens/taboshi.PNG", title: "TABOSHI" },
      { address: USDC as Address, icon: "/tokens/usdc.PNG", title: "USDC" },
      { address: WETH as Address, icon: "/tokens/weth.PNG", title: "WETH" },
    ],
    []
  );

  return (
    <section className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-4">About TobySwap</h1>
          <div className="flex flex-wrap gap-3">
            {pills.map((p) => (
              <span key={p} className="pill bg-[var(--glass)] text-sm">
                {p}
              </span>
            ))}
          </div>
          <p className="text-[var(--ink-sub)] mt-4">
            This UI calls the Toby Swapper contract on Base and constructs paths that buy-burn{" "}
            <span className="font-semibold">$TOBY</span> using the 1% fee. Data below is read on-chain
            (the same core fields BaseScan displays) and links you to the verified contracts.
          </p>
        </div>

        {/* CTA back home */}
        <Link href="/" className="pill pill-opaque hover:opacity-90 whitespace-nowrap self-start">
          ← Back home to burn more TOBY
        </Link>
      </div>

      <SwapperCard />

      <div className="grid md:grid-cols-2 gap-6">
        {items.map((t) => (
          <TokenInfoCard key={t.address} address={t.address} icon={t.icon} titleOverride={t.title} />
        ))}
      </div>

      {/* Links */}
      <div className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="font-semibold mb-4">Quick Links</h3>
        <div className="flex flex-wrap gap-3">
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
          <a className="pill" href="https://toadgod.xyz" target="_blank" rel="noopener noreferrer">
            Official Site — toadgod.xyz
          </a>
          <a className="pill" href="https://t.me/toadgang" target="_blank" rel="noopener noreferrer">
            Toadgang Telegram
          </a>
        </div>
      </div>
    </section>
  );
}
