"use client"

import { useMemo } from "react"
import { useAccount, useChainId, useSwitchChain } from "wagmi"
import { useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit"

const BASE_MAINNET = 8453
const BASE_SEPOLIA = 84532

export default function StatusBadge() {
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { openConnectModal } = useConnectModal()
  const { openAccountModal } = useAccountModal()

  const onBase = isConnected && (chainId === BASE_MAINNET || chainId === BASE_SEPOLIA)

  const state: "ok" | "warn" | "off" = useMemo(() => {
    if (!isConnected) return "off"
    if (onBase) return "ok"
    return "warn"
  }, [isConnected, onBase])

  const label = useMemo(() => {
    if (!isConnected) return "Not connected"
    if (onBase) return "Connected (Base)"
    return "Wrong network"
  }, [isConnected, onBase])

  function handleClick() {
    if (!isConnected) {
      openConnectModal?.()
      return
    }
    if (!onBase) {
      // Prefer mainnet; falls back gracefully in RainbowKit
      switchChain?.({ chainId: BASE_MAINNET })
      return
    }
    // If already connected + on Base, open account sheet
    openAccountModal?.()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`status-badge ${state === "ok" ? "ok" : state === "warn" ? "warn" : "off"}`}
      title={label}
      aria-label={label}
    >
      <span className="dot" />
      <span className="text">
        {state === "off" && "Not connected"}
        {state === "warn" && "Wrong network"}
        {state === "ok" && (address ? `${address.slice(0,6)}…${address.slice(-4)}` : "Connected")}
      </span>
    </button>
  )
}
