// components/BurnCounter.tsx
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useReadContract } from "wagmi"
import { formatUnits, type Address } from "viem"
import { ADDR, TOKENS } from "@/lib/addresses"

/** ========== ABIs ========== */
const ABI_SWAPPER = [
  {
    type: "function",
    name: "totalTobyBurned",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const

const ABI_ERC20 = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol",   stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const

type Props = {
  /** Auto-refresh cadence (ms). Default: 12s */
  refreshMs?: number
}

export default function BurnCounter({ refreshMs = 12_000 }: Props) {
  // On-chain reads
  const {
    data: burnedRaw,
    refetch: refetchBurned,
    isFetching: fetchingBurned,
    isError: burnedError,
  } = useReadContract({
    abi: ABI_SWAPPER,
    address: ADDR.SWAPPER,
    functionName: "totalTobyBurned",
  }) as { data?: bigint; refetch: () => any; isFetching: boolean; isError: boolean }

  const { data: tobyDecimals } = useReadContract({
    abi: ABI_ERC20,
    address: TOKENS.TOBY.address as Address,
    functionName: "decimals",
  }) as { data?: number }

  const { data: tobySymbol } = useReadContract({
    abi: ABI_ERC20,
    address: TOKENS.TOBY.address as Address,
    functionName: "symbol",
  }) as { data?: string }

  const decimals = tobyDecimals ?? TOKENS.TOBY.decimals

  // Target value (human units)
  const target = useMemo(() => {
    if (!burnedRaw) return 0
    // formatUnits returns a string; convert safely within JS number range
    const num = Number(formatUnits(burnedRaw, decimals))
    return Number.isFinite(num) ? num : 0
  }, [burnedRaw, decimals])

  // Smooth tween of the number to reduce jumpiness
  const [display, setDisplay] = useState(0)
  const animRef = useRef<number | null>(null)
  const lastTargetRef = useRef(0)

  useEffect(() => {
    const duration = 700 // ms
    const start = performance.now()
    const from = lastTargetRef.current
    const to = target
    lastTargetRef.current = to

    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
      setDisplay(from + (to - from) * eased)
      if (p < 1) animRef.current = requestAnimationFrame(step)
    }

    if (animRef.current) cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(step)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [target])

  // Auto-refresh
  useEffect(() => {
    const tick = () => refetchBurned()
    const id = setInterval(tick, refreshMs)
    // first fetch quickly
    tick()
    return () => clearInterval(id)
  }, [refetchBurned, refreshMs])

  // Rendering helpers
  const symbol = tobySymbol || TOKENS.TOBY.symbol

  // Compact UI value that won't overflow; full value in title tooltip
  const compact = new Intl.NumberFormat(undefined, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 2,
  }).format(display)

  const full = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 6,
  }).format(display)

  const label = burnedError ? "Burned (error)" : "Toby Burned"
  const showSkeleton = fetchingBurned && display === 0

  return (
    <div className="inline-flex flex-col items-start">
      <div
        className="burn-badge"
        title={`${full} ${symbol}`}
        aria-live="polite"
        // richer, on-brand glass background (overrides class if present)
        style={{
          background:
            "radial-gradient(120% 200% at 15% 0%, rgba(255,209,220,.40), transparent 60%)," +
            "radial-gradient(120% 200% at 85% 100%, rgba(196,181,253,.40), transparent 60%)," +
            "linear-gradient(135deg, rgba(255,255,255,.16), rgba(255,255,255,.08))",
        }}
      >
        <span className="burn-emoji" aria-hidden>🔥</span>

        {showSkeleton ? (
          <div className="burn-text">
            <span className="burn-label">{label}</span>
            <span className="burn-amount">
              <span className="inline-block align-middle animate-pulse rounded-md bg-black/10 px-8 py-2" />
            </span>
          </div>
        ) : (
          <div className="burn-text">
            <span className="burn-label">{label}</span>
            <span
              className="burn-amount"
              style={{
                // keep the number tidy even when it grows
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
              }}
            >
              {compact} {symbol}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
