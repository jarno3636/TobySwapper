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
  balance,
}: {
  value: Address;
  onChange: (a: Address) => void;
  exclude?: Address | string;
  balance?: string; // human readable
}) {
  const selected = TOKENS.find((t) => t.address.toLowerCase() === value.toLowerCase());

  return (
    <div className="glass rounded-pill px-3 py-2">
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
      <div className="flex items-center justify-between pt-2 text-xs text-inkSub">
        <span className="inline-flex items-center gap-2">
          <span className="relative inline-block w-5 h-5 rounded-full overflow-hidden">
            <Image
              src={iconMap[selected?.symbol ?? ""] ?? "/tokens/toby.PNG"}
              alt={selected?.symbol ?? "token"}
              fill
              sizes="20px"
              className="object-cover"
            />
          </span>
          {selected?.symbol}
        </span>

        {/* balance on the right */}
        <span className="font-mono">
          {balance ? Number(balance).toFixed(6) : "—"}
        </span>
      </div>
    </div>
  );
}
