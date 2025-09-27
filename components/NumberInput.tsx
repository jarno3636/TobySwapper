// components/NumberInput.tsx
"use client"

import { useRef } from "react"
import { parseUnits, formatUnits } from "viem"

type Props = {
  value: string
  onChange: (v: string) => void
  label?: string
  placeholder?: string
  /** Token symbol for suffix, e.g. "USDC" or "WETH" */
  unit?: string
  /** User balance as a string (human format, e.g. "123.45"). Enables % chips + Max. */
  balance?: string
  /** Token decimals; used for clamping and % math. Default 18. */
  decimals?: number
  /** Min/Max (human strings). Min defaults to "0". */
  min?: string
  max?: string
  /** Step used by arrow keys; default "0.1" (human). */
  step?: string
  /** Optional error text (turns border red). */
  error?: string
  /** Optional help text (shown if no error). */
  help?: string
  /** Disable input entirely. */
  disabled?: boolean
  /** Show the 25/50/75/Max quick chips (default true). */
  showPercentChips?: boolean

  /** Optional visual tone. Defaults to "dark". `dark` kept for backward-compat. */
  tone?: "dark" | "light"
  dark?: boolean
}

const clampDecimals = (v: string, decimals: number) => {
  if (!v.includes(".")) return v
  const [i, f] = v.split(".")
  return `${i}.${f.slice(0, decimals)}`
}

const sanitize = (raw: string, decimals: number) => {
  // allow only digits and a single dot
  let v = (raw ?? "").replace(/[^\d.]/g, "")
  const firstDot = v.indexOf(".")
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "")
  }
  // normalize leading zeros (keep "0" and "0.x")
  if (v && v[0] === "0" && v.length > 1 && v[1] !== ".") {
    v = String(Number(v))
  }
  // clamp fractional precision to token decimals
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
  tone,
  dark,
}: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const toneFinal: "dark" | "light" = dark ? "dark" : tone ?? "dark"

  const setPercent = (pct: number) => {
    if (!balance) return
    try {
      const balWei = parseUnits(balance || "0", decimals)
      const outWei = (balWei * BigInt(pct)) / 100n
      const human = formatUnits(outWei, decimals)
      onChange(clampDecimals(human, decimals))
    } catch {
      // ignore parse issues gracefully
    }
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

  const isDark = toneFinal === "dark"
  const baseWrap =
    "flex items-stretch gap-2 rounded-2xl border-2 px-3 py-2 shadow-[0_6px_0_#000] focus-within:outline-none"
  const darkWrap =
    "border-black bg-[linear-gradient(180deg,#0b1220,#0f172a)] text-slate-100 focus-within:ring-2 focus-within:ring-[#79ffe1]"
  const lightWrap =
    "border-black bg-white text-black focus-within:ring-2 focus-within:ring-[#79ffe1]"
  const errorWrap = isDark
    ? "border-[#ff8b8b] bg-[linear-gradient(180deg,#2a0f12,#240b0d)]"
    : "border-[#ff6b6b] bg-[#fff1f1]"

  const minusPlusBtn =
    "select-none rounded-xl border-2 border-black px-2 text-sm font-black shadow-[0_3px_0_#000] active:translate-y-[1px] active:shadow-none"
  const minusPlusDark = "bg-[linear-gradient(180deg,#0f172a,#121826)] text-slate-100"
  const minusPlusLight = "bg-gray-100 text-black"

  const unitPill =
    "self-center rounded-xl border-2 border-black px-2 py-1 text-xs font-extrabold shadow-[0_3px_0_#000]"
  const unitDark = "bg-[linear-gradient(180deg,#0f172a,#111827)] text-slate-100"
  const unitLight = "bg-gray-100 text-black"

  const labelCls = isDark ? "text-sm font-semibold text-slate-200" : "text-sm font-semibold"
  const metaCls = isDark ? "text-xs text-slate-300" : "text-xs text-black/70"

  const chipCls =
    "chip cursor-pointer select-none active:translate-y-[1px] !px-2 !py-1 text-[11px]"
  const maxMiniBtn =
    "chip !px-2 !py-[3px] text-[11px] ml-2 select-none active:translate-y-[1px]"

  const inputCls = [
    "min-w-0 flex-1 bg-transparent outline-none",
    isDark ? "text-slate-100 placeholder:text-slate-400" : "text-black placeholder:text-black/40",
  ].join(" ")

  const wrapCls = [
    baseWrap,
    disabled ? "opacity-60" : "",
    error ? errorWrap : isDark ? darkWrap : lightWrap,
  ].join(" ")

  const hasTopMeta = Boolean(label || balance || max)

  return (
    <label className="block">
      {/* Top row (label + balance/max) */}
      {hasTopMeta && (
        <div className="mb-1.5 flex items-center justify-between">
          {label ? <span className={labelCls}>{label}</span> : <span />}
          {(balance || max) && (
            <div className={metaCls}>
              Balance: <span className="font-semibold">{balance ?? max}</span>
              <button type="button" onClick={useMax} className={maxMiniBtn}>
                Max
              </button>
            </div>
          )}
        </div>
      )}

      {/* Input group */}
      <div className={wrapCls}>
        {/* Left nudge */}
        <button
          type="button"
          onClick={() => nudge(-1)}
          disabled={disabled}
          className={[minusPlusBtn, isDark ? minusPlusDark : minusPlusLight].join(" ")}
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
          className={inputCls}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onWheel={(e) => {
            // avoid accidental value changes on trackpads
            (e.target as HTMLInputElement).blur()
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault()
              nudge(1)
            } else if (e.key === "ArrowDown") {
              e.preventDefault()
              nudge(-1)
            }
          }}
          disabled={disabled}
        />

        {/* Unit suffix */}
        {unit && (
          <span className={[unitPill, isDark ? unitDark : unitLight].join(" ")} aria-hidden>
            {unit}
          </span>
        )}

        {/* Right nudge */}
        <button
          type="button"
          onClick={() => nudge(1)}
          disabled={disabled}
          className={[minusPlusBtn, isDark ? minusPlusDark : minusPlusLight].join(" ")}
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
              className={chipCls}
              title={p === 100 ? "Use max" : `Use ${p}%`}
            >
              {p === 100 ? "Max" : `${p}%`}
            </button>
          ))}
        </div>
      )}

      {/* Help / error */}
      <div className="mt-1 text-xs">
        {error ? (
          <span id="numinput-error" className="text-red-400">{error}</span>
        ) : help ? (
          <span
            id="numinput-help"
            className={isDark ? "text-slate-300/80" : "text-black/60"}
          >
            {help}
          </span>
        ) : null}
      </div>
    </label>
  )
}
