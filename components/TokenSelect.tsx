"use client";
import Image from "next/image";
import { TOKENS } from "@/lib/addresses";
import { Address } from "viem";

const iconMap: Record<string, string> = {
  USDC: "/tokens/usdc.PNG",
  WETH: "/tokens/weth.PNG",
  TOBY: "/tokens/toby.PNG",
  PATIENCE: "/tokens/patience.PNG",
  TABOSHI: "/tokens/taboshi.PNG",
};

export default function TokenSelect({
  value,
  onChange,
  exclude,
}: {
  value: Address;
  onChange: (a: Address) => void;
  exclude?: Address | string;
}) {
  return (
    <div className="glass rounded-pill px-3 py-1.5">
      <select
        className="bg-transparent w-full rounded-pill px-2 py-2 focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value as Address)}
      >
        {TOKENS.filter(
          (t) => !exclude || t.address.toLowerCase() !== String(exclude).toLowerCase()
        ).map((t) => (
          <option key={t.address} value={t.address}>
            {t.symbol}
          </option>
        ))}
      </select>

      {/* Tiny preview row under the select */}
      <div className="flex items-center gap-2 pt-2 text-xs text-inkSub">
        {TOKENS.filter((t) => t.address === value).map((t) => (
          <span key={t.address} className="inline-flex items-center gap-2">
            <span className="relative inline-block w-5 h-5 rounded-full overflow-hidden">
              <Image
                src={iconMap[t.symbol] ?? "/tokens/toby.PNG"}
                alt={t.symbol}
                fill
                sizes="20px"
                className="object-cover"
              />
            </span>
            {t.symbol}
          </span>
        ))}
      </div>
    </div>
  );
}
