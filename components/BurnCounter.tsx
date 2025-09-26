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
  /** Show a tiny “Updated Xs ago” line under the badge */
  showTimestamp?: boolean
}

export default function BurnCounter({ refreshMs = 12_000, showTimestamp = true }: Props) {
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

  // Smooth tween
  const [display, setDisplay] = useState(0)
  const animRef = useRef<number | null>(null)
  const lastTarget = useRef(0)

  const target = useMemo(() => {
    if (!burnedRaw) return 0
    const human = Number(formatUnits(burnedRaw, decimals))
    return Number.isFinite(human) ? human : 0
  }, [burnedRaw, decimals])

  useEffect(() => {
    const duration = 700 // ms
    const start = performance.now()
    const from = lastTarget.current
    const to = target
    lastTarget.current = to

    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const x = 1 - Math.pow(1 - p, 3) // easeOutCubic
      setDisplay(from + (to - from) * x)
      if (p < 1) animRef.current = requestAnimationFrame(step)
    }

    if (animRef.current) cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(step)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [target])

  // Auto-refresh + stamp
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  useEffect(() => {
    const tick = async () => {
      await refetchBurned()
      setLastUpdated(new Date())
    }
    const id = setInterval(tick, refreshMs)
    if (!lastUpdated) setLastUpdated(new Date())
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchBurned, refreshMs])

  const pretty = new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(display)
  const label = burnedError ? "Burned (error)" : "Toby Burned"
  const showSkeleton = fetchingBurned && display === 0

  return (
    <div className="inline-flex flex-col items-start">
      <div className="burn-badge" title="Total TOBY burned to 0x…dEaD" aria-live="polite">
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
            <span className="burn-amount">
              {pretty} {fallbackSymbol(tobySymbol)}
            </span>
          </div>
        )}
      </div>

      {showTimestamp && (
        <div className="mt-1 text-[11px] leading-none text-white/70">
          {burnedError ? (
            <span className="rounded-md bg-black/30 px-2 py-[2px]">RPC error — showing last known value</span>
          ) : (
            <span className="opacity-80">Updated {lastUpdated ? timeAgo(lastUpdated) : "just now"}</span>
          )}
        </div>
      )}
    </div>
  )
}

function fallbackSymbol(s?: string) {
  return s || TOKENS.TOBY.symbol
}

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}
