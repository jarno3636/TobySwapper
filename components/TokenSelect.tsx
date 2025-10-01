"use client";
import { TOKENS } from "@/lib/addresses";
import { Address } from "viem";

export default function TokenSelect({ value, onChange, exclude }: { value: Address; onChange: (a: Address)=>void; exclude?: Address }) {
  return (
    <select className="glass w-full rounded-pill px-4 py-3" value={value} onChange={(e)=>onChange(e.target.value as Address)}>
      {TOKENS.filter(t => !exclude || t.address.toLowerCase()!==exclude.toLowerCase()).map(t => (
        <option key={t.address} value={t.address}>{t.symbol}</option>
      ))}
    </select>
  );
}
