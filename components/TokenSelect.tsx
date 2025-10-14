// components/TokenSelect.tsx
"use client";
import Image from "next/image";
import { TOKENS, type TokenAddress } from "@/lib/addresses";
import type { Address } from "viem";
import { useMemo, useEffect, useRef } from "react";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { formatUnits } from "viem";

const iconMap: Record<string, string> = {
  ETH: "/tokens/baseeth.PNG",
  WETH: "/tokens/baseeth.PNG",
  USDC: "/tokens/usdc.PNG",
  TOBY: "/tokens/toby.PNG",
  PATIENCE: "/tokens/patience.PNG",
  // TABOSHI removed
};

const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

const preferredAddressForSymbol: Partial<Record<string, Address>> = {
  // If user selects ETH, we write WETH address for on-chain (keeps UI "ETH")
  ETH: (TOKENS.find(t => t.symbol === "WETH")?.address ??
    "0x0000000000000000000000000000000000000000") as Address,
};

// Keep desired ordering (TABOSHI removed)
const symbolOrder = ["ETH", "TOBY", "PATIENCE"];

export default function TokenSelect({
  user,
  value,
  onChange,
  exclude,
  balance,
  collapseETH = true,
  forceBlur = false, // prevent native picker sitting above overlays
}: {
  user?: Address;
  value: Address;
  onChange: (a: Address) => void;
  exclude?: Address | string;
  balance?: string;
  collapseETH?: boolean;
  /** When true, immediately blur the native <select> so OS overlay can’t sit above modals/toasts */
  forceBlur?: boolean;
}) {
  const selectRef = useRef<HTMLSelectElement | null>(null);

  // Blur whenever overlays are up (toast / modal)
  useEffect(() => {
    if (forceBlur && selectRef.current) {
      requestAnimationFrame(() => selectRef.current?.blur());
    }
  }, [forceBlur]);

  const selected = useMemo(() => {
    const fromList = TOKENS.find((t) => eq(t.address, value));
    if (fromList) return fromList;
    return { symbol: "UNKNOWN", address: value, decimals: 18 } as (typeof TOKENS)[number];
  }, [value]);

  const displaySymbol = selected.symbol === "WETH" ? "ETH" : (selected.symbol ?? "Unknown");

  const { value: hookBal, decimals: hookDec } = useTokenBalance(
    user,
    selected.address as TokenAddress,
    { chainId: 8453 }
  );

  const autoBal =
    hookBal !== undefined && hookDec !== undefined
      ? formatUnits(hookBal, hookDec)
      : undefined;

  const balText = useMemo(() => {
    const src = balance ?? autoBal;
    if (src == null) return "—";
    const n = Number(src);
    return Number.isFinite(n) ? n.toFixed(6) : src;
  }, [balance, autoBal]);

  const availableTokens = useMemo(() => {
    // Filter out USDC (per your original), the excluded address, and TABOSHI entirely
    const filtered = TOKENS.filter(
      (t) =>
        t.symbol !== "USDC" &&
        t.symbol !== "TABOSHI" &&
        (!exclude || !eq(t.address, String(exclude)))
    );

    const deduped: (typeof TOKENS)[number][] = [];
    if (collapseETH) {
      const seen = new Set<string>();
      for (const t of filtered) {
        const label = t.symbol === "WETH" ? "ETH" : t.symbol;
        if (seen.has(label)) continue;
        seen.add(label);
        const preferred =
          preferredAddressForSymbol[label] &&
          filtered.find((x) => eq(x.address, preferredAddressForSymbol[label]!));
        deduped.push(preferred ?? t);
      }
    } else {
      deduped.push(...filtered);
    }

    const rank = (sym: string) => {
      const label = sym === "WETH" ? "ETH" : sym;
      const i = symbolOrder.indexOf(label);
      return i === -1 ? 999 : i;
    };
    return deduped.sort((a, b) => {
      const A = a.symbol === "WETH" ? "ETH" : a.symbol;
      const B = b.symbol === "WETH" ? "ETH" : b.symbol;
      const r = rank(A) - rank(B);
      if (r !== 0) return r;
      return A.localeCompare(B);
    });
  }, [exclude, collapseETH]);

  function handleChange(next: Address) {
    const entry = TOKENS.find(t => eq(t.address, next));
    const label = entry?.symbol === "WETH" ? "ETH" : entry?.symbol;
    if (label === "ETH" && preferredAddressForSymbol.ETH) {
      onChange(preferredAddressForSymbol.ETH);
      return;
    }
    onChange(next);
  }

  return (
    <div className="glass rounded-2xl px-3 py-2 relative">
      {/* Dropdown */}
      <select
        ref={selectRef}
        className="bg-transparent w-full rounded-pill px-2 py-2 focus:outline-none text-sm font-medium appearance-none [-webkit-tap-highlight-color:transparent]"
        aria-label="Select token"
        value={value}
        onClick={(e) => {
          if (forceBlur) (e.currentTarget as HTMLSelectElement).blur();
        }}
        onChange={(e) => {
          handleChange(e.target.value as Address);
          // Kill iOS native select overlay so it doesn't sit above toasts/modals
          (e.target as HTMLSelectElement).blur();
        }}
      >
        {availableTokens.map((t) => {
          const label = t.symbol === "WETH" ? "ETH" : t.symbol;
          const val =
            label === "ETH" && preferredAddressForSymbol.ETH
              ? preferredAddressForSymbol.ETH
              : (t.address as Address);
          return (
            <option key={t.address as string} value={val}>
              {label}
            </option>
          );
        })}
        {exclude &&
          !availableTokens.some((t) => eq(t.address, String(exclude))) && (
            <option disabled>
              {TOKENS.find((t) => eq(t.address, String(exclude)))?.symbol ?? "—"}
            </option>
          )}
      </select>

      {/* Footer: icon + symbol + balance */}
      <div className="flex items-center justify-between pt-2 text-xs text-inkSub">
        <span className="inline-flex items-center gap-2">
          <span className="relative inline-block w-5 h-5 rounded-full overflow-hidden border border-white/10">
            <Image
              src={iconMap[displaySymbol] ?? "/tokens/baseeth.PNG"}
              alt={displaySymbol}
              fill
              sizes="20px"
              className="object-cover"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.src = "/tokens/baseeth.PNG";
              }}
            />
          </span>
          {displaySymbol}
        </span>
        <span className="font-mono text-right">{balText}</span>
      </div>
    </div>
  );
}
