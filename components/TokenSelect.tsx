"use client"

import { TOKENS } from "../lib/addresses"

type Opt = keyof typeof TOKENS

export default function TokenSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string
  onChange: (addr: string) => void
  options: Opt[]
  label: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <select
        className="cel-input mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
