"use client";
import Image from "next/image";
import { TOKENS } from "@/lib/addresses";
import type { Address } from "viem";
import { useMemo } from "react";

const iconMap: Record<string, string> = {
  ETH: "/tokens/baseeth.PNG",   // show Base ETH icon for ETH/WETH
  WETH: "/tokens/baseeth.PNG",  // fallback; we’ll resolve to ETH label anyway
  USDC: "/tokens/usdc.PNG",
  TOBY: "/tokens/toby.PNG",
  PATIENCE: "/tokens/patience.PNG",
  TABOSHI: "/tokens/taboshi.PNG",
};

const eq = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

export default function TokenSelect({
  value,
  onChange,
  exclude,
  balance,
}: {
  value: Address;
  onChange: (a: Address) => void;
  exclude?: Address | string;
  balance?: string; // human readable
}) {
  const selected = useMemo(
    () => TOKENS.find((t) => eq(t.address, value)),
    [value]
  );

  // Display “ETH” for WETH in the UI
  const displaySymbol = selected?.symbol === "WETH" ? "ETH" : (selected?.symbol ?? "Unknown");

  // Parse balance text safely
  const numBal = useMemo(() => {
    const n = balance != null ? Number(balance) : NaN;
    return Number.isFinite(n) ? n : undefined;
  }, [balance]);
  const balText = numBal !== undefined ? numBal.toFixed(6) : "—";

  // Build list and (1) exclude the provided address, (2) collapse WETH→ETH single entry
  const availableTokens = useMemo(() => {
    // filter out exclude
    const baseList = TOKENS.filter((t) => !exclude || !eq(t.address, String(exclude)));

    // collapse duplicates by “display symbol” (so WETH and any ETH alias become one “ETH” row)
    const seen = new Set<string>();
    const result: typeof TOKENS[number][] = [];
    for (const t of baseList) {
      const label = t.symbol === "WETH" ? "ETH" : t.symbol;
      if (seen.has(label)) continue;     // skip duplicates of the same display label
      seen.add(label);
      result.push(t);
    }
    return result;
  }, [exclude]);

  return (
    <div className="glass rounded-2xl px-3 py-2">
      {/* Dropdown */}
      <select
        className="bg-transparent w-full rounded-pill px-2 py-2 focus:outline-none text-sm font-medium"
        value={value}
        onChange={(e) => onChange(e.target.value as Address)}
      >
        {availableTokens.map((t) => (
          <option key={t.address} value={t.address}>
            {t.symbol === "WETH" ? "ETH" : t.symbol}
          </option>
        ))}
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
