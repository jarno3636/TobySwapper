"use client";
import Image from "next/image";
import { TOKENS } from "@/lib/addresses";
import type { Address } from "viem";
import { useMemo } from "react";

const iconMap: Record<string, string> = {
  USDC: "/tokens/usdc.PNG",
  WETH: "/tokens/weth.PNG",
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
  // Determine selected token metadata
  const selected = useMemo(
    () => TOKENS.find((t) => eq(t.address, value)),
    [value]
  );

  // Safe numeric balance
  const numBal = useMemo(() => {
    const n = balance != null ? Number(balance) : NaN;
    return Number.isFinite(n) ? n : undefined;
  }, [balance]);
  const balText = numBal !== undefined ? numBal.toFixed(6) : "—";

  const availableTokens = useMemo(
    () =>
      TOKENS.filter(
        (t) => !exclude || !eq(t.address, String(exclude))
      ),
    [exclude]
  );

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
            {t.symbol}
          </option>
        ))}
        {/* Show excluded token as disabled option (visual only) */}
        {exclude &&
          !availableTokens.some((t) => eq(t.address, String(exclude))) && (
            <option disabled>
              {TOKENS.find((t) => eq(t.address, String(exclude)))?.symbol ??
                "—"}
            </option>
          )}
      </select>

      {/* Footer: icon + symbol + balance */}
      <div className="flex items-center justify-between pt-2 text-xs text-inkSub">
        <span className="inline-flex items-center gap-2">
          <span className="relative inline-block w-5 h-5 rounded-full overflow-hidden border border-white/10">
            <Image
              src={iconMap[selected?.symbol ?? ""] ?? "/tokens/toby.PNG"}
              alt={selected?.symbol ?? "token"}
              fill
              sizes="20px"
              className="object-cover"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.src = "/tokens/toby.PNG";
              }}
            />
          </span>
          {selected?.symbol ?? "Unknown"}
        </span>
        <span className="font-mono text-right">{balText}</span>
      </div>
    </div>
  );
}
