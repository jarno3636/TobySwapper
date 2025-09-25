"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useReadContract } from "wagmi"
import { formatUnits, type Address } from "viem"
import { ADDR, TOKENS } from "@/lib/addresses"

const ABI_SWAPPER = [
  { type: "function", name: "totalTobyBurned", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const

const ABI_ERC20 = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const

export default function BurnCounter({
  refreshMs = 12_000, // auto-refresh every 12s
}: { refreshMs?: number }) {
  const { data: burnedRaw, refetch: refetchBurned } = useReadContract({
    abi: ABI_SWAPPER,
    address: ADDR.SWAPPER,
    functionName: "totalTobyBurned",
  }) as { data?: bigint; refetch: () => any }

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

  // simple tween so the number animates smoothly when it updates
  const [display, setDisplay] = useState(0)
  const animRef = useRef<number | null>(null)
  const lastTarget = useRef(0)

  const decimals = tobyDecimals ?? TOKENS.TOBY.decimals
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
      // easeOutCubic
      const x = 1 - Math.pow(1 - p, 3)
      setDisplay(from + (to - from) * x)
      if (p < 1) animRef.current = requestAnimationFrame(step)
    }
    if (animRef.current) cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(step)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [target])

  useEffect(() => {
    const id = setInterval(() => refetchBurned(), refreshMs)
    return () => clearInterval(id)
  }, [refetchBurned, refreshMs])

  const pretty = new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(display)

  return (
    <div className="burn-badge">
      <span className="burn-emoji">🔥</span>
      <div className="burn-text">
        <span className="burn-label">Toby Burned</span>
        <span className="burn-amount">{pretty} {toBy(tobySymbol)}</span>
      </div>
    </div>
  )
}

function toBy(s?: string) {
  // fallback to TOKENS.TOBY.symbol if chain call hasn’t returned yet
  return s || TOKENS.TOBY.symbol
}
