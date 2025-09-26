// components/Portfolio.tsx
"use client"

import { formatUnits, parseUnits } from "viem"
import { useAccount, useReadContract } from "wagmi"
import { ADDR, TOKENS } from "@/lib/addresses"
import { useTokenBalance } from "@/hooks/useTokenBalance"

/** === Router ABI (for quotes) === */
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

/** === Helpers === */
const usdc = TOKENS.USDC
const weth = TOKENS.WETH
const toby = TOKENS.TOBY
const patience = TOKENS.PATIENCE
const taboshi = TOKENS.TABOSHI

const ONE = (dec: number) => parseUnits("1", dec)

/** Build token → USDC path */
const pathUSDC = (addr: `0x${string}`) => {
  if (addr === usdc.address) return [usdc.address] as const
  if (addr === weth.address) return [weth.address, usdc.address] as const
  return [addr, ADDR.WETH, usdc.address] as const
}

/** Graceful numeric -> fixed */
function safeFixed(n: number, digits: number) {
  return Number.isFinite(n) ? n.toFixed(digits) : "–"
}

/** Card gradient presets per token (high contrast on text) */
const skin = {
  USDC: "from-sky-400/90 via-sky-500/90 to-sky-700/90 text-white",
  WETH: "from-indigo-400/90 via-purple-500/90 to-violet-700/90 text-white",
  TOBY: "from-cyan-300/90 via-cyan-400/90 to-blue-600/90 text-black", // brighter body → black text reads great
  PATIENCE: "from-rose-300/90 via-rose-400/90 to-red-600/90 text-black",
  TABOSHI: "from-emerald-300/90 via-emerald-400/90 to-green-700/90 text-black",
  TOTAL: "from-fuchsia-400/90 via-violet-500/90 to-blue-700/90 text-white",
} as const

export default function Portfolio() {
  const { address, isConnected } = useAccount()

  /** === Balances (human strings) === */
  const { human: balUSDC } = useTokenBalance(usdc.address, usdc.decimals)
  const { human: balWETH } = useTokenBalance(weth.address, weth.decimals)
  const { human: balTOBY } = useTokenBalance(toby.address, toby.decimals)
  const { human: balPATI } = useTokenBalance(patience.address, patience.decimals)
  const { human: balTABO } = useTokenBalance(taboshi.address, taboshi.decimals)

  /** === Quotes: token → USDC (per 1 token) === */
  // USDC identity (= 1)
  const priceUSDC = 1

  // WETH → USDC
  const { data: outWETH } = useReadContract({
    abi: ABI_ROUTER_V2,
    address: ADDR.ROUTER,
    functionName: "getAmountsOut",
    args: [ONE(weth.decimals), pathUSDC(weth.address)],
  }) as { data: bigint[] | undefined }
  const priceWETH = Number(formatUnits(outWETH?.[outWETH.length - 1] ?? 0n, usdc.decimals))

  // TOBY → USDC
  const { data: outTOBY } = useReadContract({
    abi: ABI_ROUTER_V2,
    address: ADDR.ROUTER,
    functionName: "getAmountsOut",
    args: [ONE(toby.decimals), pathUSDC(toby.address)],
  }) as { data: bigint[] | undefined }
  const priceTOBY = Number(formatUnits(outTOBY?.[outTOBY.length - 1] ?? 0n, usdc.decimals))

  // PATIENCE → USDC
  const { data: outPATI } = useReadContract({
    abi: ABI_ROUTER_V2,
    address: ADDR.ROUTER,
    functionName: "getAmountsOut",
    args: [ONE(patience.decimals), pathUSDC(patience.address)],
  }) as { data: bigint[] | undefined }
  const pricePATI = Number(formatUnits(outPATI?.[outPATI.length - 1] ?? 0n, usdc.decimals))

  // TABOSHI → USDC
  const { data: outTABO } = useReadContract({
    abi: ABI_ROUTER_V2,
    address: ADDR.ROUTER,
    functionName: "getAmountsOut",
    args: [ONE(taboshi.decimals), pathUSDC(taboshi.address)],
  }) as { data: bigint[] | undefined }
  const priceTABO = Number(formatUnits(outTABO?.[outTABO.length - 1] ?? 0n, usdc.decimals))

  /** === Numbers === */
  const bUSDC = Number(balUSDC || "0")
  const bWETH = Number(balWETH || "0")
  const bTOBY = Number(balTOBY || "0")
  const bPATI = Number(balPATI || "0")
  const bTABO = Number(balTABO || "0")

  const usdUSDC = bUSDC * priceUSDC
  const usdWETH = bWETH * (Number.isFinite(priceWETH) ? priceWETH : 0)
  const usdTOBY = bTOBY * (Number.isFinite(priceTOBY) ? priceTOBY : 0)
  const usdPATI = bPATI * (Number.isFinite(pricePATI) ? pricePATI : 0)
  const usdTABO = bTABO * (Number.isFinite(priceTABO) ? priceTABO : 0)

  const total = usdUSDC + usdWETH + usdTOBY + usdPATI + usdTABO

  /** === Empty / explainer state === */
  if (!isConnected) {
    return (
      <div className="rounded-3xl border-2 border-black shadow-[0_10px_0_#000,0_10px_30px_rgba(0,0,0,.35)] p-5 bg-gradient-to-br from-slate-800/70 to-slate-900/70">
        <div className="text-white font-extrabold text-lg mb-1">Your Wallet</div>
        <p className="text-white/80 text-sm leading-relaxed">
          Connect your wallet to pull balances and live USDC values for <b>USDC</b>, <b>WETH</b>, <b>TOBY</b>, <b>PATIENCE</b>, and <b>TABOSHI</b>.
          Quotes are fetched from the router on Base for accurate, on-chain pricing.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {/* Total tile */}
      <div className={`rounded-3xl border-2 border-black shadow-[0_10px_0_#000,0_10px_30px_rgba(0,0,0,.35)] p-5 bg-gradient-to-br ${skin.TOTAL}`}>
        <div className="text-sm font-black opacity-85 tracking-wide uppercase">Wallet Total</div>
        <div className="text-3xl font-black mt-1">${safeFixed(total, 2)}</div>
        <div className="text-xs opacity-85 mt-1">
          Values update live from router quotes. Tokens without direct USDC pools route via WETH.
        </div>
      </div>

      {/* Token grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* USDC */}
        <TokenTile
          title="USDC"
          symbol="USDC"
          balance={balUSDC}
          price={priceUSDC}
          usd={usdUSDC}
          gradient={skin.USDC}
          priceDecimals={2}
        />
        {/* WETH */}
        <TokenTile
          title="Wrapped Ether"
          symbol="WETH"
          balance={balWETH}
          price={priceWETH}
          usd={usdWETH}
          gradient={skin.WETH}
          priceDecimals={2}
        />
        {/* TOBY */}
        <TokenTile
          title="TOBY"
          symbol="TOBY"
          balance={balTOBY}
          price={priceTOBY}
          usd={usdTOBY}
          gradient={skin.TOBY}
          priceDecimals={6}
        />
        {/* PATIENCE */}
        <TokenTile
          title="PATIENCE"
          symbol="PATIENCE"
          balance={balPATI}
          price={pricePATI}
          usd={usdPATI}
          gradient={skin.PATIENCE}
          priceDecimals={6}
        />
        {/* TABOSHI */}
        <TokenTile
          title="TABOSHI"
          symbol="TABOSHI"
          balance={balTABO}
          price={priceTABO}
          usd={usdTABO}
          gradient={skin.TABOSHI}
          priceDecimals={6}
        />
      </div>

      {/* Small explainer */}
      <div className="text-xs text-white/80">
        Tip: Balances are read from your wallet; prices are quoted per token via Base’s router. If a pool is thin, values may fluctuate.
      </div>
    </div>
  )
}

/** === Presentational subcomponent (keeps layout clean) === */
function TokenTile({
  title,
  symbol,
  balance,
  price,
  usd,
  gradient,
  priceDecimals,
}: {
  title: string
  symbol: "USDC" | "WETH" | "TOBY" | "PATIENCE" | "TABOSHI"
  balance?: string
  price: number
  usd: number
  gradient: string
  priceDecimals: number
}) {
  // choose readable per-token unit label
  const perUnit = symbol === "USDC" ? "USDC" : `${symbol}/USDC`

  return (
    <div
      className={[
        "rounded-3xl border-2 border-black p-4",
        "shadow-[0_8px_0_#000,0_12px_28px_rgba(0,0,0,.35)]",
        "bg-gradient-to-br",
        gradient,
      ].join(" ")}
    >
      <div className="text-xs font-black tracking-wide opacity-85 uppercase">{title}</div>
      <div className="mt-1 text-2xl font-black leading-none">{balance && balance !== "0" ? balance : "0"}</div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
        <div className="rounded-xl border-2 border-black/70 bg-black/10 px-2 py-1 font-semibold">
          <div className="opacity-80">Price</div>
          <div className="font-black">
            ${safeFixed(price, priceDecimals)}
            <span className="opacity-75 text-[11px] ml-1">/ {perUnit.includes("/") ? perUnit.split("/")[0] : "1"}</span>
          </div>
        </div>
        <div className="rounded-xl border-2 border-black/70 bg-black/10 px-2 py-1 font-semibold">
          <div className="opacity-80">Value</div>
          <div className="font-black">≈ ${safeFixed(usd, 2)}</div>
        </div>
      </div>
    </div>
  )
}
