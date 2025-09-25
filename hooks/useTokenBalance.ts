"use client"

import { useAccount, useReadContract, useBalance } from "wagmi"
import { formatUnits, type Address } from "viem"

const ABI_ERC20 = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
] as const

export function useTokenBalance(token?: Address, decimalsHint?: number) {
  const { address } = useAccount()

  // Treat undefined token as native balance (not our case, but handy)
  const isNative = false // we always pass ERC-20s here; keep for future

  const { data: native } = useBalance({
    address,
    query: { enabled: !!address && isNative },
  })

  const { data: ercBal } = useReadContract({
    abi: ABI_ERC20,
    address: token,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!token && !isNative },
  }) as { data?: bigint }

  const { data: ercDec } = useReadContract({
    abi: ABI_ERC20,
    address: token,
    functionName: "decimals",
    query: { enabled: !!token && !isNative },
  }) as { data?: number }

  const decimals = isNative ? (native?.decimals ?? 18) : (ercDec ?? decimalsHint ?? 18)
  const raw = isNative ? native?.value : ercBal
  const human = raw ? formatUnits(raw, decimals) : "0"

  return { decimals, raw, human }
}
