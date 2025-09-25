"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ConnectButton } from "@rainbow-me/rainbowkit"

export default function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Trigger (mobile only) */}
      <button
        className="nav-trigger md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        title="Menu"
      >
        <span className="i">☰</span>
        <span>Menu</span>
      </button>

      {/* Drawer */}
      {open && (
        <div className="nav-drawer" role="dialog" aria-modal="true">
          <div className="nav-panel">
            {/* Drawer Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Image
                  src="/toby.PNG"    // <- PNG (uppercase) per your request
                  alt="Toby"
                  width={26}
                  height={26}
                  className="rounded-md ring-2 ring-black"
                />
                <div className="text-xl font-extrabold tracking-tight">TobySwapper</div>
              </div>
              <button
                className="nav-pill"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Connect (inside drawer) */}
            <div className="mb-4">
              <div className="nav-pill w-full justify-center py-3 text-base">
                <ConnectButton />
              </div>
            </div>

            {/* Links */}
            <nav className="grid gap-3">
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

          {/* Scrim */}
          <div className="nav-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
        </div>
      )}
    </>
  )
}
