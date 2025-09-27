"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { formatUnits, parseUnits, type Address } from "viem"
import { ADDR, TOKENS, ALLOWED_BASES, ALLOWED_COMMODITIES } from "@/lib/addresses"
import TokenSelect from "./TokenSelect"
import NumberInput from "./NumberInput"
import { useToast } from "@/components/ToastProvider"
import { useTokenBalance } from "@/hooks/useTokenBalance"
import StatusBadge from "@/components/StatusBadge"
import SwapSettings from "./SwapSettings"

const ABI_TOBY_SWAPPER = [/* unchanged from your file */] as const
const ABI_ERC20 = [/* unchanged */] as const
const ABI_ROUTER_V2 = [/* unchanged */] as const

type Direction = "USDC->TOKEN" | "ETH->TOKEN" | "TOKEN->USDC" | "TOKEN->ETH"

export default function SwapWidget() {
  const toast = useToast()
  const { address } = useAccount()

  const [fromAddr, setFromAddr] = useState<Address>(TOKENS.USDC.address)
  const [toAddr, setToAddr] = useState<Address>(TOKENS.TOBY.address)
  const [amountIn, setAmountIn] = useState<string>("")

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [slippagePct, setSlippagePct] = useState<string>("1")

  const [celebrate, setCelebrate] = useState(false)

  const fromToken = useMemo(() => Object.values(TOKENS).find(t => t.address === fromAddr)!, [fromAddr])
  const toToken   = useMemo(() => Object.values(TOKENS).find(t => t.address === toAddr)!, [toAddr])
  const { human: fromBalanceHuman } = useTokenBalance(fromAddr, fromToken.decimals)

  const direction: Direction | null = useMemo(() => {
    const isOut = ALLOWED_COMMODITIES.has(toAddr)
    const isIn  = ALLOWED_COMMODITIES.has(fromAddr)
    if (fromAddr === TOKENS.USDC.address && isOut) return "USDC->TOKEN"
    if (fromAddr === TOKENS.WETH.address && isOut) return "ETH->TOKEN"
    if (isIn && toAddr === TOKENS.USDC.address) return "TOKEN->USDC"
    if (isIn && toAddr === TOKENS.WETH.address) return "TOKEN->ETH"
    return null
  }, [fromAddr, toAddr])

  const buildMainPath = (from: Address, to: Address): Address[] => {
    if (from === TOKENS.USDC.address && ALLOWED_COMMODITIES.has(to)) return [TOKENS.USDC.address, ADDR.WETH, to]
    if (from === TOKENS.WETH.address && ALLOWED_COMMODITIES.has(to)) return [ADDR.WETH, to]
    if (ALLOWED_COMMODITIES.has(from) && to === TOKENS.USDC.address) return [from, ADDR.WETH, TOKENS.USDC.address]
    if (ALLOWED_COMMODITIES.has(from) && to === TOKENS.WETH.address) return [from, ADDR.WETH]
    return [from, to]
  }
  const buildFeePath = (from: Address): Address[] => {
    if (from === TOKENS.WETH.address) return [ADDR.WETH, TOKENS.TOBY.address]
    if (from === TOKENS.USDC.address) return [TOKENS.USDC.address, ADDR.WETH, TOKENS.TOBY.address]
    return [from, ADDR.WETH, TOKENS.TOBY.address]
  }

  const mainPath = useMemo(() => buildMainPath(fromAddr, toAddr), [fromAddr, toAddr])
  const feePath  = useMemo(() => buildFeePath(fromAddr), [fromAddr])

  const amountInWei = amountIn && Number(amountIn) > 0 ? parseUnits(amountIn, fromToken.decimals) : 0n

  const { data: amountsMain } = useReadContract({
    abi: ABI_ROUTER_V2, address: ADDR.ROUTER, functionName: "getAmountsOut",
    args: amountIn && direction ? [amountInWei, mainPath] : undefined,
  }) as { data: bigint[] | undefined }

  const { data: amountsFee } = useReadContract({
    abi: ABI_ROUTER_V2, address: ADDR.ROUTER, functionName: "getAmountsOut",
    args: amountIn && direction ? [amountInWei, feePath] : undefined,
  }) as { data: bigint[] | undefined }

  const unitInWei = 1n * (10n ** BigInt(fromToken.decimals))
  const { data: amountsUnit } = useReadContract({
    abi: ABI_ROUTER_V2, address: ADDR.ROUTER, functionName: "getAmountsOut",
    args: direction ? [unitInWei, mainPath] : undefined,
  }) as { data: bigint[] | undefined }

  const slippageNum = Number(slippagePct || "1")
  const safeSlip = Number.isFinite(slippageNum) && slippageNum >= 0 ? slippageNum : 1
  const slippageBps = BigInt(Math.round(safeSlip * 100))
  const minOutWithSlippage = (out: bigint) => (out * (10000n - slippageBps)) / 10000n

  const estOutMain = amountsMain?.[amountsMain.length - 1] ?? 0n
  const estOutFee  = amountsFee?.[amountsFee.length - 1] ?? 0n
  const minOutMain = estOutMain ? minOutWithSlippage(estOutMain) : 0n
  const minOutFee  = estOutFee  ? minOutWithSlippage(estOutFee)   : 0n

  let priceImpactPct: number | null = null
  if (amountInWei > 0n && estOutMain > 0n && amountsUnit && amountsUnit.length > 0) {
    const unitOut = Number(amountsUnit[amountsUnit.length - 1])
    const perUnitOut = (Number(estOutMain) / Number(amountInWei)) * Number(10n ** BigInt(fromToken.decimals))
    if (isFinite(unitOut) && unitOut > 0 && isFinite(perUnitOut)) {
      priceImpactPct = Math.max(0, (1 - perUnitOut / unitOut) * 100)
    }
  }

  const isEthIn = fromAddr === TOKENS.WETH.address
  const needsApproval = !isEthIn && direction !== null

  const { data: allowance } = useReadContract({
    abi: ABI_ERC20,
    address: needsApproval ? fromAddr : undefined,
    functionName: "allowance",
    args: address && needsApproval ? [address as Address, ADDR.SWAPPER] : undefined,
  }) as { data: bigint | undefined }

  const hasAllowance = needsApproval ? ((allowance ?? 0n) >= amountInWei) : true

  const { writeContract: writeApprove, data: txApprove } = useWriteContract()
  const { writeContract: writeSwap,    data: txSwap    } = useWriteContract()

  const { isLoading: approving, isSuccess: approved,  isError: approveError } =
    useWaitForTransactionReceipt({ hash: txApprove })
  const { isLoading: swapping,  isSuccess: swapped,   isError: swapError } =
    useWaitForTransactionReceipt({ hash: txSwap })

  useEffect(() => {
    if (approved) {
      toast.success({ title: "Approved", desc: `${fromToken.symbol} is now approved.` })
    }
  }, [approved, toast, fromToken.symbol])

  useEffect(() => {
    if (approveError) toast.error({ title: "Approval failed", desc: "Try again or increase gas." })
  }, [approveError, toast])

  useEffect(() => {
    if (swapped) {
      toast.success({ title: "Swap confirmed", desc: "Tokens are on the way." })
      setCelebrate(true)
      const t = setTimeout(() => setCelebrate(false), 800)
      return () => clearTimeout(t)
    }
  }, [swapped, toast])

  useEffect(() => {
    if (swapError) toast.error({ title: "Swap failed", desc: "Check slippage or liquidity." })
  }, [swapError, toast])

  function onApprove() {
    if (!needsApproval || !amountInWei) return
    writeApprove({ abi: ABI_ERC20, address: fromAddr, functionName: "approve", args: [ADDR.SWAPPER, amountInWei] })
    toast.notify({ title: "Approval submitted", desc: `Approving ${fromToken.symbol}…` })
  }

  function doSwap() {
    if (!direction || !amountInWei) return
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60)
    if (direction === "ETH->TOKEN") {
      writeSwap({
        abi: ABI_TOBY_SWAPPER as any, address: ADDR.SWAPPER,
        functionName: "swapETHForTokensSupportingFeeOnTransferTokens",
        args: [toAddr, minOutMain, mainPath, feePath, minOutFee, deadline],
        value: amountInWei,
      })
    } else if (direction === "USDC->TOKEN" || direction === "TOKEN->USDC") {
      writeSwap({
        abi: ABI_TOBY_SWAPPER as any, address: ADDR.SWAPPER,
        functionName: "swapTokensForTokensSupportingFeeOnTransferTokens",
        args: [fromAddr, toAddr, amountInWei, minOutMain, mainPath, feePath, minOutFee, deadline],
      })
    } else if (direction === "TOKEN->ETH") {
      writeSwap({
        abi: ABI_TOBY_SWAPPER as any, address: ADDR.SWAPPER,
        functionName: "swapTokensForETHSupportingFeeOnTransferTokens",
        args: [fromAddr, amountInWei, minOutMain, mainPath, feePath, deadline],
      })
    }
    toast.notify({ title: "Swap submitted", desc: "Waiting for confirmation…" })
  }

  function flipTokens() {
    const prevFrom = fromAddr
    const prevTo = toAddr
    setFromAddr(prevTo)
    setToAddr(prevFrom)
    setTimeout(() => {
      const ok =
        (ALLOWED_BASES.has(prevTo) && ALLOWED_COMMODITIES.has(prevFrom)) ||
        (ALLOWED_COMMODITIES.has(prevTo) && ALLOWED_BASES.has(prevFrom))
      if (!ok) {
        setFromAddr(TOKENS.USDC.address)
        setToAddr(TOKENS.TOBY.address)
      }
    }, 0)
  }

  const outMainHuman = estOutMain ? formatUnits(estOutMain, toToken.decimals) : "-"
  const outFeeHuman  = estOutFee  ? formatUnits(estOutFee,  TOKENS.TOBY.decimals) : "-"

  return (
    <>
      <div
        className={[
          "rounded-3xl border-2 border-black p-7 md:p-9",
          "bg-[radial-gradient(120%_160%_at_15%_-20%,rgba(124,58,237,.22),transparent),radial-gradient(120%_160%_at_85%_-10%,rgba(14,165,233,.18),transparent),linear-gradient(180deg,#0b1220,#0f172a)]",
          "text-slate-50 shadow-[0_12px_0_#000,0_26px_56px_rgba(0,0,0,.48)]",
          celebrate ? "celebrate" : "",
        ].join(" ")}
      >
        {/* Header */}
        <div className="mb-7 flex items-start justify-between">
          <h2
            className="text-[32px] md:text-[40px] font-black tracking-tight leading-none"
            style={{
              background: "linear-gradient(90deg,#a78bfa 0%,#79ffe1 50%,#93c5fd 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              textShadow: "0 4px 0 rgba(0,0,0,.38)",
            }}
          >
            Swap
          </h2>

          <div className="flex items-center gap-2 pr-1">
            <StatusBadge />
            <button
              className={[
                "inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-black",
                "bg-[linear-gradient(180deg,#0f172a,#121826)] text-slate-100",
                "shadow-[0_4px_0_#000] active:translate-y-[2px] active:shadow-[0_2px_0_#000]",
                "ml-1 mr-1 md:mr-0",
              ].join(" ")}
              onClick={() => setSettingsOpen(true)}
              aria-label="Open swap settings"
              title={`Slippage: ${Number(slippagePct || "1")}%`}
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* FROM / TO with center flip */}
        <div className="relative">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TokenSelect
              label="From"
              value={fromAddr}
              onChange={(v) => {
                setFromAddr(v)
                const isBase = ALLOWED_BASES.has(v)
                if (isBase && !ALLOWED_COMMODITIES.has(toAddr)) setToAddr(TOKENS.TOBY.address)
                if (!isBase && !ALLOWED_BASES.has(toAddr)) setToAddr(TOKENS.USDC.address)
              }}
              options={["USDC", "WETH", "TOBY", "PATIENCE", "TABOSHI"]}
            />
            <TokenSelect
              label="To"
              value={toAddr}
              onChange={setToAddr}
              options={["USDC", "WETH", "TOBY", "PATIENCE", "TABOSHI"]}
            />
          </div>

          {/* Flip button */}
          <button
            className={[
              "absolute left-1/2 -translate-x-1/2",
              "top-full -mt-5 sm:top-1/2 sm:-translate-y-1/2 sm:mt-0",
              "h-11 w-11 rounded-full border-2 border-black",
              "bg-[linear-gradient(180deg,#0f172a,#121826)] text-slate-100",
              "shadow-[0_6px_0_#000] active:translate-y-[2px] active:shadow-[0_3px_0_#000]",
              "grid place-items-center text-lg font-black",
            ].join(" ")}
            onClick={flipTokens}
            aria-label="Flip tokens"
            title="Flip"
          >
            ⇅
          </button>
        </div>

        {/* AMOUNT row */}
        <div className="mt-8">
          <NumberInput
            label="Amount"
            value={amountIn}
            onChange={setAmountIn}
            placeholder="0.0"
            unit={fromToken.symbol}
            balance={fromBalanceHuman}
            decimals={fromToken.decimals}
            max={fromBalanceHuman}
            step={fromToken.decimals === 6 ? "0.01" : "0.001"}
            showPercentChips
          />
        </div>

        {/* Slim metrics */}
        <div className="mt-6 grid gap-1 text-sm/6 text-slate-200">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="opacity-70">Est. out:</span>
            <span className="font-semibold">{outMainHuman}</span>
            <span className="opacity-40">•</span>
            <span className="opacity-70">Min out:</span>
            <span className="font-semibold">
              {minOutMain ? formatUnits(minOutMain, toToken.decimals) : "-"}
            </span>
            <span className="opacity-40">•</span>
            <span className="opacity-70">Fee→TOBY:</span>
            <span className="font-semibold">{outFeeHuman}</span>
            <span className="opacity-40">•</span>
            <span className="opacity-70">Impact:</span>
            <span className={`font-semibold ${priceImpactPct && priceImpactPct > 5 ? "text-rose-300" : ""}`}>
              {priceImpactPct === null ? "—" : `${priceImpactPct.toFixed(2)}%`}
            </span>
          </div>

          <details className="opacity-80">
            <summary className="cursor-pointer select-none">Details</summary>
            <div className="mt-1 text-xs text-slate-300/90">
              <div>Route: <code className="font-mono">
                {mainPath.map(a => Object.values(TOKENS).find(t => t.address === a)?.symbol || "???").join(" → ")}
              </code></div>
              <div>Fee path: <code className="font-mono">
                {feePath.map(a => Object.values(TOKENS).find(t => t.address === a)?.symbol || "???").join(" → ")}
              </code></div>
              <div className="opacity-80 mt-1">1% fee auto-buys TOBY and sends to burn.</div>
            </div>
          </details>
        </div>

        {/* Actions */}
        <div className="mt-7 grid gap-3">
          {!hasAllowance && (
            <button
              className={`rounded-full border-2 border-black px-5 py-3 font-black shadow-[0_6px_0_#000] bg-[linear-gradient(135deg,#f59e0b,#fde047)] text-[#241a03] ${approving ? "btn-loading" : ""}`}
              onClick={onApprove}
              disabled={approving || !amountInWei}
            >
              {approving ? "Approving..." : `Approve ${fromToken.symbol}`}
            </button>
          )}

          <button
            className={[
              "rounded-full border-2 border-black px-6 py-4 font-black text-lg",
              "bg-[linear-gradient(135deg,#10b981,#34d399)] text-[#031611]",
              "shadow-[0_8px_0_#000] active:translate-y-[2px] active:shadow-[0_4px_0_#000]",
              swapping ? "btn-loading" : "",
            ].join(" ")}
            onClick={doSwap}
            disabled={!direction || swapping || (!isEthIn && !hasAllowance) || !amountInWei}
          >
            {swapping ? "Swapping..." : "Swap"}
          </button>
        </div>
      </div>

      {/* Full-screen settings modal */}
      <SwapSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        slippagePct={slippagePct}
        setSlippagePct={setSlippagePct}
      />
    </>
  )
}
