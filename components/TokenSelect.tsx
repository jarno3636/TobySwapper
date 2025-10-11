"use client";
import Image from "next/image";
import { TOKENS, NATIVE_ETH, TokenAddress, isNative } from "@/lib/addresses";
import { useMemo } from "react";

const iconMap: Record<string, string> = {
  ETH: "/tokens/baseeth.PNG",  // Native ETH icon
  WETH: "/tokens/weth.PNG",    // Wrapped ETH icon
  USDC: "/tokens/usdc.PNG",
  TOBY: "/tokens/toby.PNG",
  PATIENCE: "/tokens/patience.PNG",
  TABOSHI: "/tokens/taboshi.PNG",
};

const eqToken = (a?: TokenAddress, b?: TokenAddress) =>
  (isNative(a) && isNative(b)) ||
  (!!a && !!b && !isNative(a) && !isNative(b) && String(a).toLowerCase() === String(b).toLowerCase());

export default function TokenSelect({
  value,
  onChange,
  exclude,
  balance,
}: {
  value: TokenAddress;
  onChange: (a: TokenAddress) => void;
  exclude?: TokenAddress | string;
  balance?: string; // human readable
}) {
  // find selected token
  const selected = useMemo(
    () => TOKENS.find((t) => eqToken(t.address as TokenAddress, value)),
    [value]
  );

  const displaySymbol = selected?.symbol ?? "Unknown";

  // Safe numeric balance
  const numBal = useMemo(() => {
    const n = balance != null ? Number(balance) : NaN;
    return Number.isFinite(n) ? n : undefined;
  }, [balance]);
  const balText = numBal !== undefined ? numBal.toFixed(6) : "—";

  // Filter out excluded token
  const availableTokens = useMemo(
    () => TOKENS.filter((t) => !exclude || !eqToken(t.address as TokenAddress, exclude as TokenAddress)),
    [exclude]
  );

  // DOM select values must be strings; serialize our TokenAddress
  const toOptionValue = (addr: TokenAddress) => (isNative(addr) ? NATIVE_ETH : String(addr));
  const fromOptionValue = (raw: string): TokenAddress => (raw === NATIVE_ETH ? NATIVE_ETH : (raw as unknown as TokenAddress));

  return (
    <div className="glass rounded-2xl px-3 py-2">
      {/* Dropdown */}
      <select
        className="bg-transparent w-full rounded-pill px-2 py-2 focus:outline-none text-sm font-medium"
        value={toOptionValue(value)}
        onChange={(e) => onChange(fromOptionValue(e.target.value))}
      >
        {availableTokens.map((t) => (
          <option key={t.symbol} value={toOptionValue(t.address)}>
            {t.symbol}
          </option>
        ))}

        {exclude &&
          !availableTokens.some((t) => eqToken(t.address as TokenAddress, exclude as TokenAddress)) && (
            <option disabled>
              {TOKENS.find((t) => eqToken(t.address as TokenAddress, exclude as TokenAddress))?.symbol ?? "—"}
            </option>
          )}
      </select>

      {/* Footer: icon + symbol + balance */}
      <div className="flex items-center justify-between pt-2 text-xs text-inkSub">
        <span className="inline-flex items-center gap-2">
          <span className="relative inline-block w-5 h-5 rounded-full overflow-hidden border border-white/10">
            <Image
              src={iconMap[displaySymbol] ?? "/tokens/toby.PNG"}
              alt={displaySymbol}
              fill
              sizes="20px"
              className="object-cover"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.src = "/tokens/toby.PNG";
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
