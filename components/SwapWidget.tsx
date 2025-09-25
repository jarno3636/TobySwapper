"use client"
import { useMemo, useState } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { parseUnits } from "viem"
import { ADDR, TOKENS, ALLOWED_BASES, ALLOWED_COMMODITIES } from "@/lib/addresses"
import { TobySwapper, ERC20, RouterV2 } from "@/lib/abi"
import TokenSelect from "./TokenSelect"
import NumberInput from "./NumberInput"

export default function SwapWidget() {
  const { address } = useAccount()
  const [fromAddr, setFromAddr] = useState(TOKENS.USDC.address)
  const [toAddr, setToAddr] = useState(TOKENS.TOBY.address)
  const [amountIn, setAmountIn] = useState("")
  const [slippagePct, setSlippagePct] = useState("1")

  // ...buildMainPath, buildFeePath, quote via getAmountsOut, approval + swap logic...

  return (
    <div className="cel-card bg-white/95 p-6">
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl">Swap</h2>
        <ConnectButton />
      </div>
      {/* token selects, amount input, approval, swap button */}
    </div>
  )
}
