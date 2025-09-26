"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useAccount } from "wagmi"
import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit"

function short(addr?: string) {
  if (!addr) return ""
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function MobileNav() {
  const [open, setOpen] = useState(false)

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
        {/* LEFT: brand (big, bold, gradient) */}
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <Image
            src="/toby.PNG"  /* NOTE: .PNG */
            alt="Toby"
            width={30}
            height={30}
            className="rounded-lg border-2 border-black shadow-[0_4px_0_#000]"
            priority
          />
          <span className="brand-title truncate">TobySwapper</span>
        </Link>

        {/* RIGHT: connect + hamburger (NO other pills outside the drawer) */}
        <div className="flex items-center gap-8">
          <button className="nav-pill" onClick={onConnectClick}>
            {isConnected ? short(address) : "Connect"}
          </button>

          <button
            className="nav-trigger"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            title="Menu"
          >
            <span className="i">☰</span> Menu
          </button>
        </div>
      </div>

      {/* RIGHT SHEET (mobile & desktop — keeps header ultra-clean) */}
      <div className={`nav-sheet ${open ? "open" : ""}`} aria-hidden={!open}>
        {/* scrim — tap to close */}
        <button className="nav-sheet__scrim" aria-label="Close menu" onClick={() => setOpen(false)} />

        {/* panel */}
        <aside className="nav-sheet__panel" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between mb-3">
            <div className="font-extrabold text-lg">Menu</div>
            <button className="nav-pill" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>
          <nav className="grid gap-3">
            <button className="nav-pill nav-pill--lg w-full justify-center" onClick={onConnectClick}>
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
        </aside>
      </div>
    </>
  )
}
