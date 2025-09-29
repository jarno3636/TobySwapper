// components/SwapWidget.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { formatUnits, parseUnits, type Address } from "viem"
import { ADDR, TOKENS, ALLOWED_BASES, ALLOWED_COMMODITIES } from "@/lib/addresses"
import TokenSelect from "./TokenSelect"
import NumberInput from "./NumberInput"
import { useToast } from "@/components/ToastProvider"
import { useTokenBalance } from "@/hooks/useTokenBalance"
import StatusBadge from "@/components/StatusBadge"
import SwapSettings from "./SwapSettings"

// keep real ABIs in your project; placeholders here
const ABI_TOBY_SWAPPER = [/* unchanged */] as const
const ABI_ERC20        = [/* unchanged */] as const
const ABI_ROUTER_V2    = [/* unchanged */] as const

type Direction = "USDC->TOKEN" | "ETH->TOKEN" | "TOKEN->USDC" | "TOKEN->ETH"

export default function SwapWidget() {
  const toast = useToast()
  const { address } = useAccount()

  // selections
  const [fromAddr, setFromAddr] = useState<Address>(TOKENS.USDC.address)
  const [toAddr,   setToAddr]   = useState<Address>(TOKENS.TOBY.address)
  const [amountIn, setAmountIn] = useState<string>("")

  // settings modal
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [slippagePct,  setSlippagePct]  = useState<string>("1")

  // celebratory pulse
  const [celebrate, setCelebrate] = useState(false)

  // meta + balances
  const fromToken = useMemo(() => Object.values(TOKENS).find(t => t.address === fromAddr)!, [fromAddr])
  const toToken   = useMemo(() => Object.values(TOKENS).find(t => t.address === toAddr)!,   [toAddr])
  const { human: fromBalanceHuman } = useTokenBalance(fromAddr, fromToken.decimals)

  // direction
  const direction: Direction | null = useMemo(() => {
    const isOut = ALLOWED_COMMODITIES.has(toAddr)
    const isIn  = ALLOWED_COMMODITIES.has(fromAddr)
    if (fromAddr === TOKENS.USDC.address && isOut) return "USDC->TOKEN"
    if (fromAddr === TOKENS.WETH.address && isOut) return "ETH->TOKEN"
    if (isIn && toAddr === TOKENS.USDC.address)     return "TOKEN->USDC"
    if (isIn && toAddr === TOKENS.WETH.address)     return "TOKEN->ETH"
    return null
  }, [fromAddr, toAddr])

  // paths
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

  // quotes
  const amountInWei = amountIn && Number(amountIn) > 0 ? parseUnits(amountIn, fromToken.decimals) : 0n

  const { data: amountsMain } = useReadContract({
    abi: ABI_ROUTER_V2, address: ADDR.ROUTER, functionName: "getAmountsOut",
    args: amountIn && direction ? [amountInWei, mainPath] : undefined,
  }) as { data: bigint[] | undefined }

  const { data: amountsFee } = useReadContract({
    abi: ABI_ROUTER_V2, address: ADDR.ROUTER, functionName: "getAmountsOut",
    args: amountIn && direction ? [amountInWei, feePath] : undefined,
  }) as { data: bigint[] | undefined }

  // baseline for impact
  const unitInWei = 1n * (10n ** BigInt(fromToken.decimals))
  const { data: amountsUnit } = useReadContract({
    abi: ABI_ROUTER_V2, address: ADDR.ROUTER, functionName: "getAmountsOut",
    args: direction ? [unitInWei, mainPath] : undefined,
  }) as { data: bigint[] | undefined }

  // slippage
  const slipNum = Number(slippagePct || "1")
  const slipBps = BigInt(Math.max(0, Math.round((Number.isFinite(slipNum) ? slipNum : 1) * 100)))
  const withSlippage = (out: bigint) => (out * (10000n - slipBps)) / 10000n

  const estOutMain = amountsMain?.at(-1) ?? 0n
  const estOutFee  = amountsFee?.at(-1)  ?? 0n
  const minOutMain = estOutMain ? withSlippage(estOutMain) : 0n
  const minOutFee  = estOutFee  ? withSlippage(estOutFee)  : 0n

  // rough impact %
  let priceImpactPct: number | null = null
  if (amountInWei > 0n && estOutMain > 0n && amountsUnit?.length) {
    const unitOut    = Number(amountsUnit.at(-1))
    const perUnitOut = (Number(estOutMain) / Number(amountInWei)) * Number(10n ** BigInt(fromToken.decimals))
    if (isFinite(unitOut) && unitOut > 0 && isFinite(perUnitOut)) {
      priceImpactPct = Math.max(0, (1 - perUnitOut / unitOut) * 100)
    }
  }

  // approvals
  const isEthIn       = fromAddr === TOKENS.WETH.address
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

  useEffect(() => { if (approved)    toast.success({ title:"Approved", desc:`${fromToken.symbol} is now approved.` }) }, [approved, toast, fromToken.symbol])
  useEffect(() => { if (approveError) toast.error({ title:"Approval failed", desc:"Try again or increase gas." }) }, [approveError, toast])
  useEffect(() => {
    if (swapped) {
      toast.success({ title:"Swap confirmed", desc:"Tokens are on the way." })
      setCelebrate(true)
      const t = setTimeout(() => setCelebrate(false), 800)
      return () => clearTimeout(t)
    }
  }, [swapped, toast])
  useEffect(() => { if (swapError)   toast.error({ title:"Swap failed", desc:"Check slippage or liquidity." }) }, [swapError, toast])

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
        args: [fromAddr, amountInWei, minOutMain, mainPath, feePath, minOutFee, deadline],
      })
    }
    toast.notify({ title: "Swap submitted", desc: "Waiting for confirmation…" })
  }

  function flipTokens() {
    const prevFrom = fromAddr
    const prevTo   = toAddr
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
          "swap-card rounded-3xl border-2 border-black p-8 md:p-10",
          "bg-[radial-gradient(120%_160%_at_15%_-20%,rgba(124,58,237,.22),transparent),radial-gradient(120%_160%_at_85%_-10%,rgba(14,165,233,.18),transparent),linear-gradient(180deg,#0b1220,#0f172a)]",
          "text-slate-50 shadow-[0_12px_0_#000,0_26px_56px_rgba(0,0,0,.48)]",
          celebrate ? "celebrate" : "",
        ].join(" ")}
      >
        {/* Header */}
        <div className="mb-8 flex items-start justify-between pr-2">
          <h2
            className="text-[40px] md:text-[48px] font-black tracking-tight leading-none"
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

          <div className="flex items-center gap-3">
            <StatusBadge />
            <button
              className="inline-grid place-items-center h-9 w-9 rounded-full border-2 border-black bg-[linear-gradient(180deg,#0f172a,#121826)] text-slate-100 shadow-[0_4px_0_#000] active:translate-y-[2px] active:shadow-[0_2px_0_#000]"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open swap settings"
              title={`Slippage: ${Number(slippagePct || "1")}%`}
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* From / To with centered flip and little ⓘ copy buttons */}
        <div className="relative">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="token-select-row relative">
              <TokenSelect
                label="From"
                value={fromAddr}
                onChange={(v) => {
                  setFromAddr(v)
                  const isBase = ALLOWED_BASES.has(v)
                  if (isBase && !ALLOWED_COMMODITIES.has(toAddr)) setToAddr(TOKENS.TOBY.address)
                  if (!isBase && !ALLOWED_BASES.has(toAddr))        setToAddr(TOKENS.USDC.address)
                }}
                options={["USDC", "WETH", "TOBY", "PATIENCE", "TABOSHI"]}
              />
              <button
                className="info-chip"
                title="Copy token address"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(fromAddr); toast.success({ title: "Copied", desc: "From token address copied." }) } catch {}
                }}
              >
                ⓘ
              </button>
            </div>

            <div className="token-select-row relative">
              <TokenSelect
                label="To"
                value={toAddr}
                onChange={setToAddr}
                options={["USDC", "WETH", "TOBY", "PATIENCE", "TABOSHI"]}
              />
              <button
                className="info-chip"
                title="Copy token address"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(toAddr); toast.success({ title: "Copied", desc: "To token address copied." }) } catch {}
                }}
              >
                ⓘ
              </button>
            </div>
          </div>

          {/* Flip button (between selectors) */}
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

        {/* Amount – dark glass; +/- hidden via CSS below */}
        <div className="mt-8 num-glass">
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

        {/* Metrics */}
        <div className="mt-6 grid gap-1 text-sm/6 text-slate-200">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="opacity-70">Est. out:</span><span className="font-semibold">{outMainHuman}</span>
            <span className="opacity-40">•</span>
            <span className="opacity-70">Min out:</span>
            <span className="font-semibold">{minOutMain ? formatUnits(minOutMain, toToken.decimals) : "-"}</span>
            <span className="opacity-40">•</span>
            <span className="opacity-70">Fee→TOBY:</span><span className="font-semibold">{outFeeHuman}</span>
            <span className="opacity-40">•</span>
            <span className="opacity-70">Impact:</span>
            <span className={`font-semibold ${priceImpactPct && priceImpactPct > 5 ? "text-rose-300" : ""}`}>
              {priceImpactPct === null ? "—" : `${priceImpactPct.toFixed(2)}%`}
            </span>
          </div>
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

          {/* Glassy green Swap */}
          <button
            className={[
              "relative overflow-hidden rounded-full border-2 border-black px-6 py-4 text-lg font-black",
              "text-[#031611]",
              "shadow-[0_8px_0_#000] active:translate-y-[2px] active:shadow-[0_4px_0_#000]",
              "bg-[linear-gradient(135deg,rgba(16,185,129,.96),rgba(52,211,153,.94))]",
              "before:absolute before:inset-0 before:pointer-events-none before:rounded-full before:opacity-[.22]",
              "before:bg-[radial-gradient(120%_150%_at_50%_-20%,#fff,transparent_60%)]",
              (!direction || swapping || (!isEthIn && !hasAllowance) || !amountInWei) ? "opacity-60" : "",
            ].join(" ")}
            onClick={doSwap}
            disabled={!direction || swapping || (!isEthIn && !hasAllowance) || !amountInWei}
          >
            {swapping ? "Swapping..." : "Swap"}
          </button>
        </div>
      </div>

      {/* Full-screen settings modal (your component already uses fixed + inset-0) */}
      <SwapSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        slippagePct={slippagePct}
        setSlippagePct={setSlippagePct}
      />

      {/* ===== Styles to force dark-glass look on NumberInput & TokenSelect without editing them ===== */}
      <style jsx global>{`
        /* TokenSelect trigger -> dark glass */
        .token-select-row button[aria-haspopup="listbox"] {
          background: linear-gradient(180deg,#0f172a,#121826) !important;
          color: #e5e7eb !important;
          border-color: #000 !important;
          box-shadow: 0 6px 0 #000 !important;
        }
        .token-select-row button[aria-haspopup="listbox"] .text-black,
        .token-select-row button[aria-haspopup="listbox"] .text-black\\/70 {
          color: #e5e7eb !important;
        }

        /* Hide token address lines inside dropdown options (keep symbol only) */
        .token-select-row [role="option"] .min-w-0 > span:last-child {
          display: none !important;
        }

        /* Tiny ⓘ chip beside selectors */
        .token-select-row .info-chip {
          position: absolute;
          right: 8px;
          top: 26px;       /* sits on the same row as trigger */
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 9999px;
          border: 2px solid #000;
          background: linear-gradient(180deg,#0f172a,#121826);
          color: #e5e7eb;
          box-shadow: 0 4px 0 #000;
        }

        /* NumberInput: make the main input group dark glass & hide +/- */
        .num-glass label > div[class*="shadow-[0_6px_0_#000]"] {
          background: linear-gradient(180deg,#0b1220,#0f172a) !important;
          border-color: #000 !important;
        }
        .num-glass input[type="text"] {
          color: #e5e7eb !important;
        }
        .num-glass label > div[class*="shadow-[0_6px_0_#000]"] > button[aria-label="Decrease"],
        .num-glass label > div[class*="shadow-[0_6px_0_#000]"] > button[aria-label="Increase"] {
          display: none !important;
        }
        .num-glass span[aria-hidden] {  /* the unit chip */
          background: linear-gradient(180deg,#0f172a,#121826) !important;
          color: #e5e7eb !important;
        }

        /* Percent chips and Max button -> dark glass */
        .num-glass button { 
          background: linear-gradient(135deg,#0f172a,#111827) !important;
          color: #e5e7eb !important;
        }
      `}</style>
    </>
  )
}
