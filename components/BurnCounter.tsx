"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useReadContract } from "wagmi"
import { formatUnits, type Address } from "viem"
import { ADDR, TOKENS } from "@/lib/addresses"

/** ========== ABIs ========== */
const ABI_SWAPPER = [
  { type: "function", name: "totalTobyBurned", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const

const ABI_ERC20 = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol",   stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const

type Props = {
  /** Auto-refresh cadence (ms). Default: 12s */
  refreshMs?: number
  /** Show a small subtle timestamp below the badge */
  showTimestamp?: boolean
}

/** Nice fallback symbol if RPC is slow */
function fallbackSymbol(s?: string) {
  return s || TOKENS.TOBY.symbol
}

export default function BurnCounter({ refreshMs = 12_000, showTimestamp = true }: Props) {
  /** On-chain reads */
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

  /** Smooth tween between values */
  const [display, setDisplay] = useState(0)
  const animRef = useRef<number | null>(null)
  const lastTarget = useRef(0)

  const target = useMemo(() => {
    if (!burnedRaw) return 0
    const human = Number(formatUnits(burnedRaw, decimals))
    return Number.isFinite(human) ? human : 0
  }, [burnedRaw, decimals])

  useEffect(()
