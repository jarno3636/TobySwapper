"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useAccount } from "wagmi"
import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit"

function short(addr?: string) {
  if (!addr) return ""
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function MobileNav() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // Wallet
  const { address, isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { openAccountModal } = useAccountModal()

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const onConnectClick = () => {
    if (isConnected) openAccountModal?.()
    else openConnectModal?.()
  }

  return (
    <>
      {/* HEADER BAR */}
      <div className="site-header w-full">
        {/* LEFT: brand (bigger, bold, gradient) */}
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <Image
            src="/toby.PNG" /* NOTE: .PNG */
            alt="Toby"
            width={34}
            height={34}
            className="rounded-lg border-2 border-black shadow-[0_4px_0_#000]"
            priority
          />
          <span className="brand-title brand-title--lg truncate">TobySwapper</span>
        </Link>

        {/* RIGHT: hamburger trigger */}
        <button
          className="nav-trigger"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          title="Menu"
        >
          <span className="i">☰</span> Menu
        </button>
      </div>

      {/* TOP DROPDOWN (¼ screen height) */}
      <div
        className={`nav-sheet nav-sheet--dropdown ${open ? "open" : ""}`}
        aria-hidden={!open}
      >
        {/* scrim — click to close */}
        <button
          className="nav-sheet__scrim"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />

        {/* panel */}
        <div
          ref={panelRef}
          className="nav-sheet__panel"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="font-extrabold text-lg">Menu</div>
            <button
              className="nav-pill"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <nav className="grid gap-3">
            <button
              className="nav-pill nav-pill--lg w-full justify-center"
              onClick={onConnectClick}
            >
              {isConnected ? short(address) : "Connect"}
            </button>

            <Link
              href="/"
              className="nav-pill nav-pill--lg w-full justify-center no-underline"
              onClick={() => setOpen(false)}
            >
              🏠 Home
            </Link>

            <Link
              href="/lore"
              className="nav-pill nav-pill--lg w-full justify-center no-underline"
              onClick={() => setOpen(false)}
            >
              📜 Lore
            </Link>
          </nav>
        </div>
      </div>
    </>
  )
}
