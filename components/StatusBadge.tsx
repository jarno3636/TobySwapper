// components/StatusBadge.tsx
"use client"

import { useMemo } from "react"
import { useAccount, useChainId, useSwitchChain } from "wagmi"
import { useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit"

const BASE_MAINNET = 8453
const BASE_SEPOLIA = 84532

export default function StatusBadge() {
  const { isConnected, address } = useAccount()
  const chainId = useChainId()

  const {
    switchChain,
    isPending: switching,
  } = useSwitchChain()

  const { openConnectModal } = useConnectModal()
  const { openAccountModal } = useAccountModal()

  const onBase =
    isConnected && (chainId === BASE_MAINNET || chainId === BASE_SEPOLIA)

  const state: "ok" | "warn" | "off" = useMemo(() => {
    if (!isConnected) return "off"
    if (onBase) return "ok"
    return "warn"
  }, [isConnected, onBase])

  const label = useMemo(() => {
    if (!isConnected) return "Not connected"
    if (switching) return "Switching to Base…"
    if (onBase) return "Connected (Base)"
    return "Wrong network"
  }, [isConnected, onBase, switching])

  function handleClick() {
    if (!isConnected) {
      openConnectModal?.()
      return
    }
    if (!onBase) {
      // Prefer Base mainnet; RainbowKit will show confirm in wallet
      switchChain?.({ chainId: BASE_MAINNET })
      return
    }
    // Already connected on Base → open Account sheet
    openAccountModal?.()
  }

  // Visual variants
  const wrapClass =
    state === "ok"
      ? "from-emerald-400/90 to-emerald-300/90 text-[#0a0b12]"
      : state === "warn"
      ? "from-amber-400/90 to-orange-300/90 text-[#0a0b12]"
      : "from-slate-800/90 to-slate-700/90 text-sky-50"

  const dotClass =
    state === "ok"
      ? "bg-emerald-600"
      : state === "warn"
      ? "bg-orange-600"
      : "bg-slate-400"

  return (
    <button
      type="button"
      onClick={handleClick}
      title={label}
      aria-label={label}
      className={[
        // pill frame
        "inline-flex items-center gap-2",
        "rounded-full border-2 border-black",
        "px-3 py-1.5 font-extrabold",
        "shadow-[0_6px_0_#000] active:translate-y-[1px] active:shadow-[0_3px_0_#000]",
        // glossy bg
        "bg-gradient-to-br",
        wrapClass,
        // ensure legibility everywhere
        "whitespace-nowrap select-none",
        "transition-transform duration-100",
      ].join(" ")}
    >
      {/* status dot / spinner */}
      <span
        className={[
          "relative inline-flex h-2.5 w-2.5 rounded-full",
          dotClass,
          "ring-2 ring-black/40",
        ].join(" ")}
        aria-hidden
      >
        {switching && (
          <span
            className="absolute -inset-1 animate-ping rounded-full bg-black/30"
            aria-hidden
          />
        )}
      </span>

      <span className="text-xs tracking-wide">
        {switching
          ? "Switching…"
          : state === "off"
          ? "Not connected"
          : state === "warn"
          ? "Wrong network"
          : address
          ? `${address.slice(0, 6)}…${address.slice(-4)}`
          : "Connected"}
      </span>
    </button>
  )
}
