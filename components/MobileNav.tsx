"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAccount } from "wagmi"
import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit"

/** Utility: 0x1234…abcd */
function short(addr?: string) {
  if (!addr) return ""
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function MobileNav() {
  const [open, setOpen] = useState(false)
  const { address, isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { openAccountModal } = useAccountModal()

  // Close drawer on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function onConnectClick() {
    if (isConnected && openAccountModal) {
      openAccountModal()
    } else if (openConnectModal) {
      openConnectModal()
    }
  }

  return (
    <>
      {/* Right-side trigger */}
      <button
        className="nav-trigger md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        title="Menu"
      >
        <span aria-hidden>☰</span>
      </button>

      {/* Drawer */}
      <div className={`nav-sheet ${open ? "open" : ""}`} aria-hidden={!open}>
        {/* panel */}
        <div className="nav-sheet__panel" role="dialog" aria-modal="true">
          <nav className="grid gap-3">
            <button
              className="nav-pill w-full justify-center py-3 text-base"
              onClick={onConnectClick}
            >
              {isConnected ? short(address) : "Connect"}
            </button>

            <Link
              href="/"
              className="nav-pill w-full justify-center py-3 text-base no-underline"
              onClick={() => setOpen(false)}
            >
              🏠 Home
            </Link>

            <Link
              href="/lore"
              className="nav-pill w-full justify-center py-3 text-base no-underline"
              onClick={() => setOpen(false)}
            >
              📜 Lore
            </Link>
          </nav>
        </div>

        {/* scrim — click to close */}
        <button
          className="nav-sheet__scrim"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      </div>
    </>
  )
}
