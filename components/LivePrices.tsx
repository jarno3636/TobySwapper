// components/LivePrices.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useReadContract } from "wagmi"
import { formatUnits, parseUnits, type Address } from "viem"
import { ADDR, TOKENS } from "@/lib/addresses"

/** ===== Router ABI ===== */
const ABI_ROUTER_V2 = [
  {
    type: "function",
    name: "getAmountsOut",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const

/** ===== Helpers ===== */
type WatchToken = {
  key: "TOBY" | "PATIENCE" | "TABOSHI" | "WETH"
  address: Address
  symbol: string
  decimals: number
}

const WATCH: WatchToken[] = [
  { key: "TOBY",     ...TOKENS.TOBY     },
  { key: "PATIENCE", ...TOKENS.PATIENCE },
  { key: "TABOSHI",  ...TOKENS.TABOSHI  },
  { key: "WETH",     ...TOKENS.WETH     },
] as unknown as WatchToken[]

// token -> WETH -> USDC (WETH -> USDC direct)
function usdPath(token: Address): Address[] {
  if (token === TOKENS.WETH.address) return [TOKENS.WETH.address, TOKENS.USDC.address]
  return [token, ADDR.WETH, TOKENS.USDC.address]
}

function fmtPrice(n: number, isEth = false) {
  if (!Number.isFinite(n)) return "–"
  // Eth 2 decimals; others tighter but readable
  return isEth ? n.toFixed(2) : (n < 0.01 ? n.toFixed(6) : n.toFixed(4))
}

/** ===== PriceTile ===== */
function PriceTile({
  label,
  price,
  loading,
  error,
}: {
  label: string
  price: string
  loading: boolean
  error: boolean
}) {
  return (
    <div className="rounded-2xl border-2 border-black p-4 shadow-[0_6px_0_#000]
                    bg-white text-black/90">
      <div className="text-[11px] font-extrabold tracking-wide text-black/60 mb-1">
        {label}
      </div>
      {loading ? (
        <div className="h-7 w-24 rounded-lg bg-black/10 animate-pulse" />
      ) : error ? (
        <div className="text-sm font-bold text-red-600">Error</div>
      ) : (
        <div className="text-2xl leading-none font-black tabular-nums">${price}</div>
      )}
    </div>
  )
}

/** ===== LivePrices (on-chain quotes via router) ===== */
export default function LivePrices({ refreshMs = 12_000 }: { refreshMs?: number }) {
  // Build static inputs
  const inputs = useMemo(
    () =>
      WATCH.map((t) => ({
        token: t,
        amountIn: parseUnits("1", t.decimals),
        path: usdPath(t.address),
      })),
    []
  )

  // 4 stable reads (Rules of Hooks: no loops calling hooks)
  const t0 = inputs[0], t1 = inputs[1], t2 = inputs[2], t3 = inputs[3]

  const q0 = useReadContract({
    abi: ABI_ROUTER_V2,
    address: ADDR.ROUTER,
    functionName: "getAmountsOut",
    args: [t0.amountIn, t0.path],
  }) as { data?: bigint[]; isFetching: boolean; isError: boolean; refetch: () => any }

  const q1 = useReadContract({
    abi: ABI_ROUTER_V2,
    address: ADDR.ROUTER,
    functionName: "getAmountsOut",
    args: [t1.amountIn, t1.path],
  }) as { data?: bigint[]; isFetching: boolean; isError: boolean; refetch: () => any }

  const q2 = useReadContract({
    abi: ABI_ROUTER_V2,
    address: ADDR.ROUTER,
    functionName: "getAmountsOut",
    args: [t2.amountIn, t2.path],
  }) as { data?: bigint[]; isFetching: boolean; isError: boolean; refetch: () => any }

  const q3 = useReadContract({
    abi: ABI_ROUTER_V2,
    address: ADDR.ROUTER,
    functionName: "getAmountsOut",
    args: [t3.amountIn, t3.path],
  }) as { data?: bigint[]; isFetching: boolean; isError: boolean; refetch: () => any }

  // Auto-refresh
  const [stamp, setStamp] = useState<Date | null>(null)
  useEffect(() => {
    const tick = async () => {
      await Promise.all([q0.refetch(), q1.refetch(), q2.refetch(), q3.refetch()])
      setStamp(new Date())
    }
    const id = setInterval(tick, refreshMs)
    if (!stamp) setStamp(new Date())
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMs])

  // Compose outputs
  const usdcDec = TOKENS.USDC.decimals
  const tiles = [
    {
      sym: t0.token.symbol,
      isEth: t0.token.symbol === "WETH",
      out: q0.data?.[q0.data.length - 1],
      loading: q0.isFetching && !q0.data,
      error: q0.isError,
    },
    {
      sym: t1.token.symbol,
      isEth: t1.token.symbol === "WETH",
      out: q1.data?.[q1.data.length - 1],
      loading: q1.isFetching && !q1.data,
      error: q1.isError,
    },
    {
      sym: t2.token.symbol,
      isEth: t2.token.symbol === "WETH",
      out: q2.data?.[q2.data.length - 1],
      loading: q2.isFetching && !q2.data,
      error: q2.isError,
    },
    {
      sym: t3.token.symbol,
      isEth: t3.token.symbol === "WETH",
      out: q3.data?.[q3.data.length - 1],
      loading: q3.isFetching && !q3.data,
      error: q3.isError,
    },
  ].map((r) => {
    const priceNum = r.out ? Number(formatUnits(r.out, usdcDec)) : NaN
    return {
      label: `${r.sym} / USDC`,
      price: fmtPrice(priceNum, r.isEth),
      loading: r.loading,
      error: r.error,
    }
  })

  return (
    <div className="grid gap-4">
      {/* Small explainer */}
      <div className="rounded-2xl border-2 border-black p-4 shadow-[0_6px_0_#000]
                      bg-gradient-to-br from-white via-white to-[#f7f4ff] text-black/85">
        <div className="font-extrabold text-sm mb-1">Live Prices</div>
        <div className="text-xs opacity-80">
          Quotes are fetched from the Base router using <code className="pill">getAmountsOut</code> for
          1 token → USDC (via WETH when needed). Numbers refresh automatically.
        </div>
      </div>

      {/* Price tiles */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <PriceTile
            key={t.label}
            label={t.label}
            price={t.price}
            loading={t.loading}
            error={t.error}
          />
        ))}
      </div>

      {/* Timestamp */}
      <div className="text-[11px] text-white/70">
        Updated {stamp ? timeAgo(stamp) : "just now"}
      </div>
    </div>
  )
}

/** Tiny time-ago helper */
function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}
