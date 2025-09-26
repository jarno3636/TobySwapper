// components/SwapWidget.tsx
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi"
import { formatUnits, parseUnits, type Address } from "viem"
import { ADDR, TOKENS, ALLOWED_BASES, ALLOWED_COMMODITIES } from "@/lib/addresses"
import TokenSelect from "./TokenSelect"
import NumberInput from "./NumberInput"
import { useToast } from "@/components/ToastProvider"
import { useTokenBalance } from "@/hooks/useTokenBalance"
import StatusBadge from "@/components/StatusBadge"

/** ========= ABIs (inline) ========= **/
const ABI_TOBY_SWAPPER = [
  {
    type: "function",
    name: "swapETHForTokensSupportingFeeOnTransferTokens",
    stateMutability: "payable",
    inputs: [
      { name: "tokenOut", type: "address" },
      { name: "minOutMain", type: "uint256" },
      { name: "pathForMainSwap", type: "address[]" },
      { name: "pathForFeeSwap", type: "address[]" },
      { name: "minOutFee", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "swapTokensForTokensSupportingFeeOnTransferTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minOutMain", type: "uint256" },
      { name: "pathForMainSwap", type: "address[]" },
      { name: "pathForFeeSwap", type: "address[]" },
      { name: "minOutFee", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "swapTokensForETHSupportingFeeOnTransferTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minOutMain", type: "uint256" },
      { name: "pathForMainSwap", type: "address[]" },
      { name: "pathForFeeSwap", type: "address[]" },
      { name: "minOutFee", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
] as const

const ABI_ERC20 = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const

const ABI_ROUTER_V2 = [
  { type: "function", name: "getAmountsOut", stateMutability: "view", inputs: [{ name: "amountIn", type: "uint256" }, { name: "path", type: "address[]" }], outputs: [{ name: "amounts", type: "uint256[]" }] },
] as const
/** ========= End ABIs ========= **/

type Direction = "USDC->TOKEN" | "ETH->TOKEN" | "TOKEN->USDC" | "TOKEN->ETH"

export default function SwapWidget() {
  const toast = useToast()
  const { address } = useAccount()

  // Selections
  const [fromAddr, setFromAddr] = useState<Address>(TOKENS.USDC.address)
  const [toAddr, setToAddr] = useState<Address>(TOKENS.TOBY.address)
  const [amountIn, setAmountIn] = useState<string>("")
  const [slippagePct, setSlippagePct] = useState<string>("1")

  // Visual celebrate pulse on success
  const [celebrate, setCelebrate] = useState(false)

  // Token meta + balance
  const fromToken = useMemo(
    () => Object.values(TOKENS).find((t) => t.address === fromAddr)!,
    [fromAddr],
  )
  const toToken = useMemo(
    () => Object.values(TOKENS).find((t) => t.address === toAddr)!,
    [toAddr],
  )
  const { human: fromBalanceHuman } = useTokenBalance(fromAddr, fromToken.decimals)

  // Direction
  const direction: Direction | null = useMemo(() => {
    const isOut = ALLOWED_COMMODITIES.has(toAddr)
    const isIn = ALLOWED_COMMODITIES.has(fromAddr)
    if (fromAddr === TOKENS.USDC.address && isOut) return "USDC->TOKEN"
    if (fromAddr === TOKENS.WETH.address && isOut) return "ETH->TOKEN"
    if (isIn && toAddr === TOKENS.USDC.address) return "TOKEN->USDC"
    if (isIn && toAddr === TOKENS.WETH.address) return "TOKEN->ETH"
    return null
  }, [fromAddr, toAddr])

  /** Paths */
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
  const feePath = useMemo(() => buildFeePath(fromAddr), [fromAddr])

  const routeLabels = (path: Address[]) =>
    path.map((a) => Object.values(TOKENS).find((t) => t.address === a)?.symbol || "???").join(" → ")

  /** Quotes */
  const amountInWei = amountIn && Number(amountIn) > 0 ? parseUnits(amountIn, fromToken.decimals) : 0n

  const { data: amountsMain } = useReadContract({
    abi: ABI_ROUTER_V2,
    address: ADDR.ROUTER,
    functionName: "getAmountsOut",
    args: amountIn && direction ? [amountInWei, mainPath] : undefined,
  }) as { data: bigint[] | undefined }

  const { data: amountsFee } = useReadContract({
    abi: ABI_ROUTER_V2,
    address: ADDR.ROUTER,
    functionName: "getAmountsOut",
    args: amountIn && direction ? [amountInWei, feePath] : undefined,
  }) as { data: bigint[] | undefined }

  // Baseline price for 1 unit (rough price impact)
  const unitInWei = 1n * (10n ** BigInt(fromToken.decimals))
  const { data: amountsUnit } = useReadContract({
    abi: ABI_ROUTER_V2,
    address: ADDR.ROUTER,
    functionName: "getAmountsOut",
    args: direction ? [unitInWei, mainPath] : undefined,
  }) as { data: bigint[] | undefined }

  const slippageNum = Number(slippagePct || "1")
  const safeSlip = Number.isFinite(slippageNum) && slippageNum >= 0 ? slippageNum : 1
  const slippageBps = BigInt(Math.round(safeSlip * 100))
  const minOutWithSlippage = (out: bigint) => (out * (10000n - slippageBps)) / 10000n

  const estOutMain = amountsMain?.[amountsMain.length - 1] ?? 0n
  const estOutFee = amountsFee?.[amountsFee.length - 1] ?? 0n
  const minOutMain = estOutMain ? minOutWithSlippage(estOutMain) : 0n
  const minOutFee = estOutFee ? minOutWithSlippage(estOutFee) : 0n

  let priceImpactPct: number | null = null
  if (amountInWei > 0n && estOutMain > 0n && amountsUnit && amountsUnit.length > 0) {
    const unitOut = Number(amountsUnit[amountsUnit.length - 1])
    const perUnitOut = (Number(estOutMain) / Number(amountInWei)) * Number(10n ** BigInt(fromToken.decimals))
    if (isFinite(unitOut) && unitOut > 0 && isFinite(perUnitOut)) {
      priceImpactPct = Math.max(0, (1 - perUnitOut / unitOut) * 100)
    }
  }

  /** Approvals */
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
  const { writeContract: writeSwap, data: txSwap } = useWriteContract()

  const { isLoading: approving, isSuccess: approved, isError: approveError } =
    useWaitForTransactionReceipt({ hash: txApprove })
  const { isLoading: swapping, isSuccess: swapped, isError: swapError } =
    useWaitForTransactionReceipt({ hash: txSwap })

  // Toast side-effects + celebrate pulse
  const didApproveOk = useRef(false)
  const didApproveErr = useRef(false)
  const didSwapOk = useRef(false)
  const didSwapErr = useRef(false)

  useEffect(() => {
    if (approved && !didApproveOk.current) {
      toast.success({ title: "Approved", desc: `${fromToken.symbol} is now approved.` })
      didApproveOk.current = true
    }
  }, [approved, toast, fromToken.symbol])

  useEffect(() => {
    if (approveError && !didApproveErr.current) {
      toast.error({ title: "Approval failed", desc: "Try again or increase gas." })
      didApproveErr.current = true
    }
  }, [approveError, toast])

  useEffect(() => {
    if (swapped && !didSwapOk.current) {
      toast.success({ title: "Swap confirmed", desc: "Tokens are on the way." })
      setCelebrate(true)
      const t = setTimeout(() => setCelebrate(false), 800)
      didSwapOk.current = true
      return () => clearTimeout(t)
    }
  }, [swapped, toast])

  useEffect(() => {
    if (swapError && !didSwapErr.current) {
      toast.error({ title: "Swap failed", desc: "Check slippage or liquidity." })
      didSwapErr.current = true
    }
  }, [swapError, toast])

  function onApprove() {
    if (!needsApproval || !amountInWei) return
    writeApprove({
      abi: ABI_ERC20,
      address: fromAddr,
      functionName: "approve",
      args: [ADDR.SWAPPER, amountInWei],
    })
    toast.notify({ title: "Approval submitted", desc: `Approving ${fromToken.symbol}…` })
  }

  function doSwap() {
    if (!direction || !amountInWei) return
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60)

    if (direction === "ETH->TOKEN") {
      writeSwap({
        abi: ABI_TOBY_SWAPPER as any,
        address: ADDR.SWAPPER,
        functionName: "swapETHForTokensSupportingFeeOnTransferTokens",
        args: [toAddr, minOutMain, mainPath, feePath, minOutFee, deadline],
        value: amountInWei,
      })
    } else if (direction === "USDC->TOKEN" || direction === "TOKEN->USDC") {
      writeSwap({
        abi: ABI_TOBY_SWAPPER as any,
        address: ADDR.SWAPPER,
        functionName: "swapTokensForTokensSupportingFeeOnTransferTokens",
        args: [fromAddr, toAddr, amountInWei, minOutMain, mainPath, feePath, minOutFee, deadline],
      })
    } else if (direction === "TOKEN->ETH") {
      writeSwap({
        abi: ABI_TOBY_SWAPPER as any,
        address: ADDR.SWAPPER,
        functionName: "swapTokensForETHSupportingFeeOnTransferTokens",
        args: [fromAddr, amountInWei, minOutMain, mainPath, feePath, minOutFee, deadline],
      })
    }
    toast.notify({ title: "Swap submitted", desc: "Waiting for confirmation…" })
  }

  const outMainHuman = estOutMain ? formatUnits(estOutMain, toToken.decimals) : "-"
  const outFeeHuman = estOutFee ? formatUnits(estOutFee, TOKENS.TOBY.decimals) : "-"

  return (
    <div
      className={[
        "rounded-3xl border-2 border-black p-4 md:p-6",
        "bg-[radial-gradient(60%_140%_at_20%_0%,rgba(124,58,237,.28),transparent),radial-gradient(60%_120%_at_85%_0%,rgba(14,165,233,.25),transparent),linear-gradient(180deg,#0b1220,#0f172a)]",
        "shadow-[0_12px_0_#000,0_26px_56px_rgba(0,0,0,.48)] transition-[box-shadow,filter,transform] duration-150",
        "hover:shadow-[0_12px_0_#000,0_0_0_2px_rgba(255,255,255,.12)_inset,0_36px_80px_rgba(0,0,0,.55)]",
        celebrate ? "celebrate" : "",
      ].join(" ")}
    >
      <div className="cel-card cel-card--content rounded-2xl p-5 md:p-7">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2
            className="text-2xl md:text-3xl font-black tracking-tight leading-none"
            style={{
              background: "linear-gradient(90deg,#a78bfa 0%,#79ffe1 50%,#93c5fd 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              textShadow: "0 2px 0 rgba(0,0,0,.18)",
            }}
          >
            Swap
          </h2>
          <StatusBadge />
        </div>

        {/* Selectors */}
        <div className="grid sm:grid-cols-2 gap-4">
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

        {/* Inputs */}
        <div className="mt-4 grid gap-4">
          <NumberInput
            label="Amount In"
            value={amountIn}
            onChange={setAmountIn}
            placeholder="0.0"
            unit={fromToken.symbol}
            balance={fromBalanceHuman}
            decimals={fromToken.decimals}
            max={fromBalanceHuman}
            step={fromToken.decimals === 6 ? "0.01" : "0.001"}
            help="Use the ± nudges to fine tune."
          />
          <NumberInput
            label="Slippage"
            value={slippagePct}
            onChange={setSlippagePct}
            placeholder="1"
            unit="%"
            decimals={2}
            step="0.1"
            showPercentChips={false}
            help="Most swaps work with 1–2% slippage. Increase cautiously if liquidity is thin."
          />
        </div>

        {/* Warning for unsupported pairs */}
        {direction === null && (
          <div className="mt-2 text-sm text-red-500 font-semibold">
            Pair not supported. Use USDC/ETH ↔ TOBY/PATIENCE/TABOSHI.
          </div>
        )}

        {/* Metrics */}
        <div
          className="mt-6 rounded-2xl border-2 border-black p-4 text-sm"
          style={{
            background:
              "linear-gradient(135deg, rgba(248,250,252,1), rgba(241,245,249,1))", // light, crisp
            boxShadow: "0 6px 0 #000",
          }}
        >
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <b>Route:</b>
            <span className="chip">{routeLabels(mainPath)}</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div><b>Est. out (main):</b> {outMainHuman}</div>
            <div><b>Min out (main):</b> {minOutMain ? formatUnits(minOutMain, toToken.decimals) : "-"}</div>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
              <b>Fee path (→ TOBY):</b> <span className="chip">{routeLabels(feePath)}</span>
            </div>

            <div><b>Est. out (fee→TOBY):</b> {outFeeHuman}</div>

            <div className="flex items-center gap-2">
              <b>Price impact:</b>
              <span className="chip">
                {priceImpactPct === null ? "—" : `${priceImpactPct.toFixed(2)}%`}
              </span>
            </div>
          </div>

          <div className="text-xs opacity-90 pt-2">
            1% fee is taken by the Swapper, auto-buys TOBY and sends to <b>0x…dEaD</b>.
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {!hasAllowance && (
            <button
              className={`cel-btn cel-btn--warn ${approving ? "btn-loading" : ""}`}
              onClick={onApprove}
              disabled={approving || !amountInWei}
            >
              {approving ? "Approving..." : `Approve ${fromToken.symbol}`}
            </button>
          )}

          <button
            className={`cel-btn cel-btn--good ${swapping ? "btn-loading" : ""} ${hasAllowance ? "sm:col-span-2" : ""}`}
            onClick={doSwap}
            disabled={!direction || swapping || (!isEthIn && !hasAllowance) || !amountInWei}
          >
            {swapping ? "Swapping..." : "Swap"}
          </button>
        </div>
      </div>
    </div>
  )
}
