// components/Portfolio.tsx
"use client"

import { formatUnits, parseUnits } from "viem"
import { useAccount, useReadContract } from "wagmi"
import { ADDR, TOKENS } from "@/lib/addresses"
import { useTokenBalance } from "@/hooks/useTokenBalance"

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

const list = [TOKENS.USDC, TOKENS.WETH, TOKENS.TOBY, TOKENS.PATIENCE, TOKENS.TABOSHI]

function usdPath(addr: `0x${string}`) {
  if (addr === TOKENS.USDC.address) return [TOKENS.USDC.address] // identity
  if (addr === TOKENS.WETH.address) return [TOKENS.WETH.address, TOKENS.USDC.address]
  return [addr, ADDR.WETH, TOKENS.USDC.address]
}

export default function Portfolio() {
  const { address } = useAccount()

  const rows = list.map((t) => {
    const { human, raw } = useTokenBalance(t.address, t.decimals) // no 'wei' here ✔

    const path = usdPath(t.address)
    const needsQuote = path.length > 1

    const { data } = useReadContract({
      abi: ABI_ROUTER_V2,
      address: needsQuote ? ADDR.ROUTER : undefined,
      functionName: needsQuote ? "getAmountsOut" : undefined,
      args: needsQuote ? [parseUnits("1", t.decimals), path] : undefined,
    }) as { data: bigint[] | undefined }

    // Price in USDC per 1 token
    const pOut = needsQuote ? data?.[data.length - 1] ?? 0n : 1n * 10n ** BigInt(TOKENS.USDC.decimals)
    const price = Number(formatUnits(pOut, TOKENS.USDC.decimals)) // token → USDC

    const balanceNum = Number(human || "0")
    const usd = balanceNum * (isFinite(price) ? price : 0)

    return { ...t, bal: human, price, usd }
  })

  const total = rows.reduce((s, r) => s + (isFinite(r.usd) ? r.usd : 0), 0)

  return (
    <div className="grid gap-3">
      <div className="rounded-2xl border-2 border-black bg-white p-3 shadow-[0_6px_0_#000] flex items-center justify-between">
        <div className="text-sm font-bold text-black/60">Wallet</div>
        <div className="text-xl font-extrabold">
          ${isFinite(total) ? total.toFixed(2) : "0.00"}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((r) => (
          <div
            key={r.symbol}
            className="rounded-2xl border-2 border-black bg-white p-3 shadow-[0_6px_0_#000]"
          >
            <div className="text-xs font-bold text-black/60 mb-1">{r.symbol}</div>
            <div className="text-lg font-extrabold">{r.bal || "0"}</div>
            <div className="text-xs text-black/60 mt-1">
              ${isFinite(r.price) ? r.price.toFixed(r.symbol === "WETH" ? 2 : 6) : "–"} / {TOKENS.USDC.symbol}
            </div>
            <div className="text-sm font-bold mt-1">≈ ${isFinite(r.usd) ? r.usd.toFixed(2) : "0.00"}</div>
          </div>
        ))}
      </div>

      {!address && (
        <div className="text-xs text-black/60">Connect your wallet to see balances.</div>
      )}
    </div>
  )
}
