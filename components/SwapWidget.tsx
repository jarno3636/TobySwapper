"use client"

import { useEffect, useMemo, useRef, useState } from "react"
// import { ConnectButton } from "@rainbow-me/rainbowkit"  // ❌ removed
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { formatUnits, parseUnits, type Address } from "viem"
import { ADDR, TOKENS, ALLOWED_BASES, ALLOWED_COMMODITIES } from "@/lib/addresses"
import TokenSelect from "./TokenSelect"
import NumberInput from "./NumberInput"
import { useToast } from "@/components/ToastProvider"
import { useTokenBalance } from "@/hooks/useTokenBalance"
import StatusBadge from "@/components/StatusBadge"  // ✅ new

/** … ABIs exactly as you have them … **/

type Direction = "USDC->TOKEN" | "ETH->TOKEN" | "TOKEN->USDC" | "TOKEN->ETH"

export default function SwapWidget() {
  const toast = useToast()
  const { address } = useAccount()

  const [fromAddr, setFromAddr] = useState<Address>(TOKENS.USDC.address)
  const [toAddr, setToAddr]     = useState<Address>(TOKENS.TOBY.address)
  const [amountIn, setAmountIn] = useState<string>("")
  const [slippagePct, setSlippagePct] = useState<string>("1")

  const fromToken = useMemo(() => Object.values(TOKENS).find(t => t.address === fromAddr)!, [fromAddr])
  const toToken   = useMemo(() => Object.values(TOKENS).find(t => t.address === toAddr)!,   [toAddr])
  const { human: fromBalanceHuman } = useTokenBalance(fromAddr, fromToken.decimals)

  const direction: Direction | null = useMemo(() => {
    const isOut = ALLOWED_COMMODITIES.has(toAddr)
    const isIn  = ALLOWED_COMMODITIES.has(fromAddr)
    if (fromAddr === TOKENS.USDC.address && isOut) return "USDC->TOKEN"
    if (fromAddr === TOKENS.WETH.address && isOut) return "ETH->TOKEN"
    if (isIn && toAddr === TOKENS.USDC.address)     return "TOKEN->USDC"
    if (isIn && toAddr === TOKENS.WETH.address)     return "TOKEN->ETH"
    return null
  }, [fromAddr, toAddr])

  /** Paths / quotes … unchanged (your existing code) **/

  /** Approvals / swap … unchanged (your existing code) **/

  const outMainHuman = estOutMain ? formatUnits(estOutMain, toToken.decimals) : "-"
  const outFeeHuman  = estOutFee  ? formatUnits(estOutFee , TOKENS.TOBY.decimals) : "-"

  return (
    <div className="swap-root grid gap-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="section-title">Swap</div>
        <StatusBadge /> {/* ✅ replaces ConnectButton */}
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
            if (!isBase && !ALLOWED_BASES.has(toAddr))       setToAddr(TOKENS.USDC.address)
          }}
          options={["USDC","WETH","TOBY","PATIENCE","TABOSHI"]}
        />
        <TokenSelect label="To" value={toAddr} onChange={setToAddr} options={["USDC","WETH","TOBY","PATIENCE","TABOSHI"]} />
      </div>

      {/* Inputs */}
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
        help="Use the % chips or the +/- nudges to fine tune."
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

      {direction === null && (
        <div className="text-sm text-red-600">Pair not supported. Use USDC/ETH ↔ TOBY/PATIENCE/TABOSHI.</div>
      )}

      {/* Metrics — force readable contrast */}
      <div className="metrics-card grid gap-4 rounded-2xl border-2 border-black bg-white p-4 shadow-[0_6px_0_#000] text-sm text-black/85">
        <div className="flex flex-wrap items-center gap-2">
          <b>Route:</b>
          <span className="pill">{routeLabels(mainPath)}</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><b>Est. out (main):</b> {outMainHuman}</div>
          <div><b>Min out (main):</b> {minOutMain ? formatUnits(minOutMain, toToken.decimals) : "-"}</div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
            <b>Fee path (→ TOBY):</b> <span className="pill">{routeLabels(feePath)}</span>
          </div>
          <div><b>Est. out (fee→TOBY):</b> {outFeeHuman}</div>
          <div className="flex items-center gap-2">
            <b>Price impact:</b>
            <span className={`pill ${priceImpactPct && priceImpactPct > 5 ? "bg-[#ff6b6b]" : ""}`}>
              {priceImpactPct === null ? "—" : `${priceImpactPct.toFixed(2)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {!hasAllowance && (
        <button className={`cel-btn cel-btn--warn ${approving ? "btn-loading" : ""}`} onClick={onApprove} disabled={approving || !amountInWei}>
          {approving ? "Approving..." : `Approve ${fromToken.symbol}`}
        </button>
      )}
      <button
        className={`cel-btn cel-btn--good ${swapping ? "btn-loading" : ""}`}
        onClick={doSwap}
        disabled={!direction || swapping || (!isEthIn && !hasAllowance) || !amountInWei}
      >
        {swapping ? "Swapping..." : "Swap"}
      </button>

      <div className="text-xs text-black/60">
        1% fee is taken by the Swapper contract, auto-buys TOBY and sends it to <b>0x…dEaD</b>.
      </div>
    </div>
  )
}
