"use client"

import type { Address } from "viem"
import { TOKENS } from "../lib/addresses"

type Opt = keyof typeof TOKENS

export default function TokenSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: Address
  onChange: (addr: Address) => void
  options: Opt[]
  label: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <select
        className="cel-input mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value as Address)}
      >
        {options.map((k) => (
          <option key={k} value={TOKENS[k].address}>
            {TOKENS[k].symbol}
          </option>
        ))}
      </select>
    </label>
  )
}
