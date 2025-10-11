"use client";
import Image from "next/image";
import { TOKENS } from "@/lib/addresses";
import type { Address } from "viem";
import { useMemo } from "react";

const iconMap: Record<string, string> = {
  ETH: "/tokens/baseeth.PNG",   // Base ETH icon for ETH/WETH
  WETH: "/tokens/baseeth.PNG",  // (collapsed anyway)
  USDC: "/tokens/usdc.PNG",
  TOBY: "/tokens/toby.PNG",
  PATIENCE: "/tokens/patience.PNG",
  TABOSHI: "/tokens/taboshi.PNG",
};

const eq = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * Preferred address per display symbol.
 * For "ETH", we use the WETH address under the hood.
 */
const preferredAddressForSymbol: Partial<Record<string, Address>> = {
  ETH: (TOKENS.find(t => t.symbol === "WETH")?.address ?? "0x0000000000000000000000000000000000000000") as Address,
};

/** Optional custom order for nicer UX. Unknown symbols go last alphabetically. */
const symbolOrder = ["ETH", "USDC", "TOBY", "PATIENCE", "TABOSHI"];

export default function TokenSelect({
  value,
  onChange,
  exclude,
  balance,
  collapseETH = true,
}: {
  value: Address;
  onChange: (a: Address) => void;
  exclude?: Address | string;
  balance?: string; // human readable
  /** collapse any ETH/WETH dupes down to a single "ETH" option (default true) */
  collapseETH?: boolean;
}) {
  /** Selected metadata (or fallback if not found) */
  const selected = useMemo(() => {
    const fromList = TOKENS.find((t) => eq(t.address, value));
    if (fromList) return fromList;
    // Fallback entry (keeps control stable even if value not in TOKENS)
    return {
      symbol: "UNKNOWN",
      address: value,
      decimals: 18,
    } as (typeof TOKENS)[number];
  }, [value]);

  /** UI label: display WETH as ETH */
  const displaySymbol = selected.symbol === "WETH" ? "ETH" : (selected.symbol ?? "Unknown");

  /** Safe balance text */
  const numBal = useMemo(() => {
    const n = balance != null ? Number(balance) : NaN;
    return Number.isFinite(n) ? n : undefined;
  }, [balance]);
  const balText = numBal !== undefined ? numBal.toFixed(6) : "—";

  /** Build list: exclude, collapse WETH→ETH, sort for UX */
  const availableTokens = useMemo(() => {
    // Step 1: filter out excluded
    const filtered = TOKENS.filter((t) => !exclude || !eq(t.address, String(exclude)));

    // Step 2: collapse dupes by display label if asked
    const deduped: (typeof TOKENS)[number][] = [];
    if (collapseETH) {
      const seen = new Set<string>();
      for (const t of filtered) {
        const label = t.symbol === "WETH" ? "ETH" : t.symbol;
        if (seen.has(label)) continue;
        seen.add(label);

        // Prefer specific address if we have a preference for that label
        const preferred =
          preferredAddressForSymbol[label] &&
          filtered.find((x) => eq(x.address, preferredAddressForSymbol[label]!));
        deduped.push(preferred ?? t);
      }
    } else {
      deduped.push(...filtered);
    }

    // Step 3: sort by preferred symbol order, then alphabetically
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

  /** When a user picks an option, normalize "ETH" → WETH address (preferred) */
  function handleChange(next: Address) {
    // If user chose a token whose display is "ETH", remap to preferred ETH address
    const entry = TOKENS.find(t => eq(t.address, next));
    const label = entry?.symbol === "WETH" ? "ETH" : entry?.symbol;
    if (label === "ETH" && preferredAddressForSymbol.ETH) {
      onChange(preferredAddressForSymbol.ETH);
      return;
    }
    onChange(next);
  }

  return (
    <div className="glass rounded-2xl px-3 py-2">
      {/* Dropdown */}
      <select
        className="bg-transparent w-full rounded-pill px-2 py-2 focus:outline-none text-sm font-medium"
        aria-label="Select token"
        value={value}
        onChange={(e) => handleChange(e.target.value as Address)}
      >
        {availableTokens.map((t) => {
          const label = t.symbol === "WETH" ? "ETH" : t.symbol;
          const val =
            label === "ETH" && preferredAddressForSymbol.ETH
              ? preferredAddressForSymbol.ETH
              : t.address;
          return (
            <option key={t.address} value={val}>
              {label}
            </option>
          );
        })}
        {/* If exclude is not in list anymore, still show disabled tag so UX explains why it’s missing */}
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
