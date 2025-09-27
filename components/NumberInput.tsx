"use client"

import { useRef } from "react"
import { parseUnits, formatUnits } from "viem"

type Props = {
  value: string
  onChange: (v: string) => void
  label?: string
  placeholder?: string
  unit?: string
  balance?: string
  decimals?: number
  min?: string
  max?: string
  step?: string
  error?: string
  help?: string
  disabled?: boolean
  showPercentChips?: boolean
}

const clampDecimals = (v: string, decimals: number) => {
  if (!v.includes(".")) return v
  const [i, f] = v.split(".")
  return `${i}.${f.slice(0, decimals)}`
}

const sanitize = (raw: string, decimals: number) => {
  let v = (raw ?? "").replace(/[^\d.]/g, "")
  const firstDot = v.indexOf(".")
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "")
  }
  if (v && v[0] === "0" && v.length > 1 && v[1] !== ".") {
    v = String(Number(v))
  }
  v = clampDecimals(v, decimals)
  return v
}

const clampToRange = (v: string, min?: string, max?: string) => {
  if (!v) return v
  const n = Number(v)
  if (Number.isFinite(n)) {
    if (min !== undefined && n < Number(min)) return min
    if (max !== undefined && n > Number(max)) return max
  }
  return v
}

export default function NumberInput({
  value,
  onChange,
  label,
  placeholder,
  unit,
  balance,
  decimals = 18,
  min = "0",
  max,
  step = "0.1",
  error,
  help,
  disabled,
  showPercentChips = true,
}: Props) {
  const ref = useRef<HTMLInputElement>(null)

  const setPercent = (pct: number) => {
    if (!balance) return
    try {
      const balWei = parseUnits(balance || "0", decimals)
      const outWei = (balWei * BigInt(pct)) / 100n
      const human = formatUnits(outWei, decimals)
      onChange(clampDecimals(human, decimals))
    } catch {}
  }

  const useMax = () => {
    const src = (max ?? balance)
    if (!src) return
    onChange(clampDecimals(src, decimals))
  }

  const handleChange = (raw: string) => {
    const v1 = sanitize(raw, decimals)
    const v2 = clampToRange(v1, min, max)
    onChange(v2)
  }

  const nudge = (dir: 1 | -1) => {
    const cur = value || "0"
    try {
      const curWei = parseUnits(cur, decimals)
      const stepWei = parseUnits(step, decimals)
      const nextWei = dir === 1 ? curWei + stepWei : curWei - stepWei
      const boundedWei = nextWei < 0n ? 0n : nextWei
      const human = formatUnits(boundedWei, decimals)
      onChange(clampToRange(clampDecimals(human, decimals), min, max))
    } catch {
      const num = Math.max(0, (parseFloat(cur) || 0) + dir * (parseFloat(step) || 0.1))
      onChange(clampToRange(clampDecimals(String(num), decimals), min, max))
    }
  }

  const hasTopMeta = Boolean(label || balance || max)

  return (
    <label className="block">
      {/* Top row */}
      {hasTopMeta && (
        <div className="mb-1 flex items-center justify-between">
          {label ? (
            <span className="text-sm font-semibold text-slate-200">{label}</span>
          ) : <span />}
          {(balance || max) && (
            <div className="text-xs text-slate-300">
              Balance: <span className="font-semibold">{balance ?? max}</span>
              <button
                type="button"
                onClick={useMax}
                className={[
                  "ml-2 rounded-full border-2 border-black px-2 py-0.5 font-extrabold",
                  "bg-[linear-gradient(135deg,#0f172a,#111827)] text-slate-100",
                  "shadow-[0_3px_0_#000] active:translate-y-[1px] active:shadow-none",
                ].join(" ")}
              >
                Max
              </button>
            </div>
          )}
        </div>
      )}

      {/* Input group – dark gradient */}
      <div
        className={[
          "flex items-stretch gap-2 rounded-2xl border-2 px-3 py-2 shadow-[0_6px_0_#000]",
          disabled ? "opacity-60" : "",
          error
            ? "border-[#ff6b6b] bg-[linear-gradient(180deg,#2a0f12,#3a0f12)]"
            : "border-black bg-[linear-gradient(180deg,#0b1220,#0f172a)]",
          "focus-within:ring-2 focus-within:ring-[#79ffe1]",
        ].join(" ")}
      >
        {/* Left nudge */}
        <button
          type="button"
          onClick={() => nudge(-1)}
          disabled={disabled}
          className={[
            "select-none rounded-xl border-2 border-black px-2 text-sm font-black",
            "bg-[linear-gradient(180deg,#0f172a,#121826)] text-slate-100",
            "shadow-[0_3px_0_#000] active:translate-y-[1px] active:shadow-none",
          ].join(" ")}
          aria-label="Decrease"
          title={`- ${step}`}
        >
          −
        </button>

        {/* Text input */}
        <input
          ref={ref}
          inputMode="decimal"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? "numinput-error" : help ? "numinput-help" : undefined}
          pattern="[0-9]*[.]?[0-9]*"
          className="min-w-0 flex-1 bg-transparent text-slate-50 outline-none placeholder:text-slate-400/60"
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onWheel={(e) => { (e.target as HTMLInputElement).blur() }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") { e.preventDefault(); nudge(1) }
            else if (e.key === "ArrowDown") { e.preventDefault(); nudge(-1) }
          }}
          disabled={disabled}
        />

        {/* Unit chip */}
        {unit && (
          <span
            className={[
              "self-center rounded-lg border-2 border-black px-2 py-1 text-xs font-extrabold",
              "bg-[linear-gradient(180deg,#0f172a,#121826)] text-slate-100",
              "shadow-[0_3px_0_#000]",
            ].join(" ")}
            aria-hidden
          >
            {unit}
          </span>
        )}

        {/* Right nudge */}
        <button
          type="button"
          onClick={() => nudge(1)}
          disabled={disabled}
          className={[
            "select-none rounded-xl border-2 border-black px-2 text-sm font-black",
            "bg-[linear-gradient(180deg,#0f172a,#121826)] text-slate-100",
            "shadow-[0_3px_0_#000] active:translate-y-[1px] active:shadow-none",
          ].join(" ")}
          aria-label="Increase"
          title={`+ ${step}`}
        >
          +
        </button>
      </div>

      {/* Quick chips */}
      {showPercentChips && (balance || max) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {[25, 50, 75, 100].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPercent(p)}
              className={[
                "rounded-full border-2 border-black px-2 py-1 text-xs font-extrabold",
                "bg-[linear-gradient(135deg,#0f172a,#111827)] text-slate-100",
                "shadow-[0_3px_0_#000] active:translate-y-[1px] active:shadow-none",
              ].join(" ")}
            >
              {p === 100 ? "Max" : `${p}%`}
            </button>
          ))}
        </div>
      )}

      {/* Help / error */}
      <div className="mt-1 text-xs">
        {error ? (
          <span id="numinput-error" className="text-rose-300">{error}</span>
        ) : help ? (
          <span id="numinput-help" className="text-slate-300/80">{help}</span>
        ) : null}
      </div>
    </label>
  )
}
