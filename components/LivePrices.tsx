// components/LivePrices.tsx
"use client"

import { useMemo } from "react"
import { useReadContract } from "wagmi"
import { formatUnits, parseUnits, type Address } from "viem"
import { ADDR, TOKENS } from "@/lib/addresses"

const ABI_ROUTER_V2 = [
  { type: "function", name: "getAmountsOut", stateMutability: "view", inputs: [
    { name: "amountIn", type: "uint256" }, { name: "path", type: "address[]" }],
    outputs: [{ name: "amounts", type: "uint256[]" }] },
] as const

const watchList = [TOKENS.TOBY, TOKENS.PATIENCE, TOKENS.TABOSHI, TOKENS.WETH]

function usdQuotePath(token: Address): Address[] {
  // token -> WETH -> USDC (WETH direct when needed)
  if (token === TOKENS.WETH.address) return [TOKENS.WETH.address, TOKENS.USDC.address]
  return [token, ADDR.WETH, TOKENS.USDC.address]
}

export default function LivePrices() {
  const unit = parseUnits("1", 18)
  const reads = watchList.map(t => {
    const path = usdQuotePath(t.address)
    const { data } = useReadContract({
      abi: ABI_ROUTER_V2,
      address: ADDR.ROUTER,
      functionName: "getAmountsOut",
      args: [parseUnits("1", t.decimals), path],
    }) as { data: bigint[] | undefined }
    const out = data?.[data.length - 1] ?? 0n
    return { sym: t.symbol, price: Number(formatUnits(out, TOKENS.USDC.decimals)) }
  })

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {reads.map(({ sym, price }) => (
        <div key={sym} className="rounded-2xl border-2 border-black bg-white p-3 shadow-[0_6px_0_#000]">
          <div className="text-xs font-bold text-black/60 mb-1">{sym}/USDC</div>
          <div className="text-2xl font-extrabold">${isFinite(price) ? price.toFixed(sym === "WETH" ? 2 : 6) : "–"}</div>
        </div>
      ))}
    </div>
  )
}
