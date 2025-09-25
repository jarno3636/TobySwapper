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
    if (isConnected) {
      openAccountModal?.()
    } else {
      openConnectModal?.()
    }
  }

  return (
    <>
      {/* HEADER BAR */}
      <div className="site-header w-full">
        {/* LEFT: brand */}
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/toby.PNG"  // note .PNG
              alt="Toby"
              width={28}
              height={28}
              className="rounded-lg border-2 border-black shadow-[0_4px_0_#000]"
              priority
            />
            <span className="font-black tracking-tight text-lg md:text-xl truncate">
              TobySwapper
            </span>
          </Link>
        </div>

        {/* RIGHT: connect + hamburger (hamburger only on mobile) */}
        <div className="flex items-center gap-2">
          <button className="nav-pill" onClick={onConnectClick}>
            {isConnected ? short(address) : "Connect"}
          </button>

          <button
            className="nav-trigger md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            title="Menu"
          >
            <span className="i">☰</span> Menu
          </button>

          {/* Desktop inline nav (nice pills) */}
          <nav className="hidden md:flex items-center gap-2">
            <Link className="nav-pill no-underline" href="/">🏠 Home</Link>
            <Link className="nav-pill no-underline" href="/lore">📜 Lore</Link>
          </nav>
        </div>
      </div>

      {/* RIGHT SHEET (mobile) */}
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
            <button className="nav-pill w-full justify-center py-3 text-base" onClick={onConnectClick}>
              {isConnected ? short(address) : "Connect"}
            </button>
            <Link href="/" className="nav-pill w-full justify-center py-3 text-base no-underline" onClick={() => setOpen(false)}>
              🏠 Home
            </Link>
            <Link href="/lore" className="nav-pill w-full justify-center py-3 text-base no-underline" onClick={() => setOpen(false)}>
              📜 Lore
            </Link>
          </nav>
        </aside>
      </div>
    </>
  )
}
