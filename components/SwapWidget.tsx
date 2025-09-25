"use client"

import { useMemo, useState } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi"
import { parseUnits } from "viem"
import { ADDR, TOKENS, ALLOWED_BASES, ALLOWED_COMMODITIES } from "@/lib/addresses"
import TokenSelect from "./TokenSelect"
import NumberInput from "./NumberInput"

/** ========= Inline ABIs (no separate files) ========= **/
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
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const

const ABI_ROUTER_V2 = [
  { type: "function", name: "WETH", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
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
/** ========= End ABIs ========= **/

type Direction = "USDC->TOKEN" | "ETH->TOKEN" | "TOKEN->USDC" | "TOKEN->ETH"

export default function SwapWidget() {
  const { address } = useAccount()

  const [fromAddr, setFromAddr] = useState<string>(TOKENS.USDC.address)
  const [toAddr, setToAddr] = useState<string>(TOKENS.TOBY.address)
  const [amountIn, setAmountIn] = useState<string>("")
  const [slippagePct, setSlippagePct] = useState<string>("1") // % (e.g., "1" = 1%)

  // Determine which function to call based on pair
  const direction: Direction | null = useMemo(() => {
    const isCommodityOut = ALLOWED_COMMODITIES.has(toAddr)
    const isCommodityIn = ALLOWED_COMMODITIES.has(fromAddr)

    if (fromAddr === TOKENS.USDC.address && isCommodityOut) return "USDC->TOKEN"
    if (fromAddr === TOKENS.WETH.address && isCommodityOut) return "ETH->TOKEN"
    if (isCommodityIn && toAddr === TOKENS.USDC.address) return "TOKEN->USDC"
    if (isCommodityIn && toAddr === TOKENS.WETH.address) return "TOKEN->ETH"
    return null
  }, [fromAddr, toAddr])

  /** --------- Paths --------- */
  function buildMainPath(from: string, to: string): `0x${string}`[] {
    // Favor WETH routing for better liquidity depth
    if (from === TOKENS.USDC.address && ALLOWED_COMMODITIES.has(to)) {
      return [TOKENS.USDC.address, ADDR.WETH, to] as `0x${string}`[]
    }
    if (from === TOKENS.WETH.address && ALLOWED_COMMODITIES.has(to)) {
      return [ADDR.WETH, to] as `0x${string}`[]
    }
    if (ALLOWED_COMMODITIES.has(from) && to === TOKENS.USDC.address) {
      return [from as `0x${string}`, ADDR.WETH as `0x${string}`, TOKENS.USDC.address as `0x${string}`]
    }
    if (ALLOWED_COMMODITIES.has(from) && to === TOKENS.WETH.address) {
      return [from as `0x${string}`, ADDR.WETH as `0x${string}`]
    }
    // fallback (shouldn’t normally hit)
    return [from as `0x${string}`, to as `0x${string}`]
  }

  function buildFeePath(from: string): `0x${string}`[] {
    // Always route fee to TOBY via WETH if needed
    if (from === TOKENS.WETH.address) return [ADDR.WETH, TOKENS.TOBY.address] as `0x${string}`[]
    if (from === TOKENS.USDC.address) return [TOKENS.USDC.address, ADDR.WETH, TOKENS.TOBY.address] as `0x${string}`[]
    return [from as `0x${string}`, ADDR.WETH as `0x${string}`, TOKENS.TOBY.address as `0x${string}`]
  }

  /** --------- Amounts & Slippage --------- */
  const amountInWei =
    amountIn && Number(amountIn) > 0
      ? parseUnits(amountIn, fromAddr === TOKENS.USDC.address ? TOKENS.USDC.decimals : 18)
      : 0n

  const { data: amountsMain } = useReadContract({
    abi: ABI_ROUTER_V2,
    address: ADDR.ROUTER,
    functionName: "getAmountsOut",
    args: amountIn && direction ? [amountInWei, buildMainPath(fromAddr, toAddr)] : undefined,
  }) as { data: bigint[] | undefined }

  const { data: amountsFee } = useReadContract({
    abi: ABI_ROUTER_V2,
    address: ADDR.ROUTER,
    functionName: "getAmountsOut",
    args: amountIn && direction ? [amountInWei, buildFeePath(fromAddr)] : undefined,
  }) as { data: bigint[] | undefined }

  function minOutWithSlippage(out: bigint) {
    const bps = BigInt(Math.round(parseFloat(slippagePct || "1") * 100)) // 1% => 100 bps
    return (out * (10000n - bps)) / 10000n
  }

  const minOutMain = amountsMain && amountsMain.length > 0 ? minOutWithSlippage(amountsMain[amountsMain.length - 1]) : 0n
  const minOutFee  = amountsFee  && amountsFee.length  > 0 ? minOutWithSlippage(amountsFee[amountsFee.length - 1])   : 0n

  /** --------- Approvals (ERC20 only; ETH needs none) --------- */
  const isEthIn = fromAddr === TOKENS.WETH.address // represents native ETH path
  const needsApproval = !isEthIn && direction !== null

  const { data: allowance } = useReadContract({
    abi: ABI_ERC20,
    address: needsApproval ? (fromAddr as `0x${string}`) : undefined,
    functionName: "allowance",
    args: address && needsApproval ? [address, ADDR.SWAPPER] : undefined,
  }) as { data: bigint | undefined }

  const hasAllowance = needsApproval ? ((allowance ?? 0n) >= amountInWei) : true

  const { writeContract: writeApprove, data: txApproveHash } = useWriteContract()
  const { isLoading: approving } = useWaitForTransactionReceipt({ hash: txApproveHash })

  function onApprove() {
    if (!needsApproval || !amountInWei) return
    writeApprove({
      abi: ABI_ERC20,
      address: fromAddr as `0x${string}`,
      functionName: "approve",
      args: [ADDR.SWAPPER, amountInWei],
    })
  }

  /** --------- Swap --------- */
  const { writeContract: writeSwap, data: txSwapHash } = useWriteContract()
  const { isLoading: swapping } = useWaitForTransactionReceipt({ hash: txSwapHash })

  function doSwap() {
    if (!direction || !amountInWei) return
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60) // +20 min
    const pathMain = buildMainPath(fromAddr, toAddr)
    const pathFee = buildFeePath(fromAddr)

    if (direction === "ETH->TOKEN") {
      // native ETH path
      writeSwap({
        abi: ABI_TOBY_SWAPPER as any,
        address: ADDR.SWAPPER,
        functionName: "swapETHForTokensSupportingFeeOnTransferTokens",
        args: [toAddr, minOutMain, pathMain, pathFee, minOutFee, deadline],
        value: amountInWei,
      })
      return
    }

    if (direction === "USDC->TOKEN" || direction === "TOKEN->USDC") {
      writeSwap({
        abi: ABI_TOBY_SWAPPER as any,
        address: ADDR.SWAPPER,
        functionName: "swapTokensForTokensSupportingFeeOnTransferTokens",
        args: [fromAddr, toAddr, amountInWei, minOutMain, pathMain, pathFee, minOutFee, deadline],
      })
      return
    }

    if (direction === "TOKEN->ETH") {
      writeSwap({
        abi: ABI_TOBY_SWAPPER as any,
        address: ADDR.SWAPPER,
        functionName: "swapTokensForETHSupportingFeeOnTransferTokens",
        args: [fromAddr, amountInWei, minOutMain, pathMain, pathFee, minOutFee, deadline],
      })
      return
    }
  }

  /** --------- UI --------- */
  return (
    <div className="cel-card bg-white/95 p-6 md:p-8">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-2xl font-bold">Swap</h2>
        <ConnectButton />
      </div>

      <div className="grid gap-4">
        <TokenSelect
          label="From"
          value={fromAddr}
          onChange={(v) => {
            setFromAddr(v)
            // Auto-fix 'to' if illegal
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

        <NumberInput label="Amount In" value={amountIn} onChange={setAmountIn} placeholder="0.0" />
        <NumberInput label="Slippage (%)" value={slippagePct} onChange={setSlippagePct} placeholder="1" />

        {direction === null && (
          <div className="text-sm text-red-600">
            Pair not supported. Use USDC/ETH ↔ TOBY/PATIENCE/TABOSHI.
          </div>
        )}

        <div className="text-sm text-gray-700">
          <div>
            Est. out (main):{" "}
            {amountsMain && amountsMain.length > 0 ? amountsMain[amountsMain.length - 1].toString() : "-"}
          </div>
          <div>Min out (main): {minOutMain.toString()}</div>
          <div>
            Est. out (fee→TOBY):{" "}
            {amountsFee && amountsFee.length > 0 ? amountsFee[amountsFee.length - 1].toString() : "-"}
          </div>
          <div>Min out (fee): {minOutFee.toString()}</div>
        </div>

        {!hasAllowance && (
          <button className="cel-btn bg-yellow-300" onClick={onApprove} disabled={approving || !amountInWei}>
            {approving ? "Approving..." : "Approve Token"}
          </button>
        )}

        <button
          className="cel-btn bg-green-300"
          onClick={doSwap}
          disabled={!direction || swapping || (!isEthIn && !hasAllowance) || !amountInWei}
        >
          {swapping ? "Swapping..." : "Swap"}
        </button>

        <div className="text-xs text-gray-600">
          Fee: 1% (handled in your Swapper — auto-buys TOBY and burns to 0x…dEaD).
        </div>
      </div>
    </div>
  )
}
