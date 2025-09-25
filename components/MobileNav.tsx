// components/MobileNav.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { ConnectButton } from "@rainbow-me/rainbowkit"

export default function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Trigger */}
      <button
        className="pill md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        title="Menu"
      >
        ☰ Menu
      </button>

      {/* Drawer */}
      {open && (
        <div className="nav-drawer" role="dialog" aria-modal="true">
          <div className="nav-panel">
            {/* Header row */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-extrabold tracking-tight">Toby Swapper</div>
              <button
                className="pill"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Connect (inside drawer) */}
            <div className="mb-4">
              <div className="pill w-full justify-center py-3 font-bold text-lg bg-gradient-to-r from-pink-200 to-purple-200 hover:scale-[1.02] transition">
                <ConnectButton />
              </div>
            </div>

            {/* Nav links */}
            <nav className="grid gap-3">
              <Link
                className="pill w-full justify-center py-3 font-semibold text-lg hover:bg-gray-100 transition"
                href="/"
                onClick={() => setOpen(false)}
              >
                🏠 Home
              </Link>
              <Link
                className="pill w-full justify-center py-3 font-semibold text-lg hover:bg-gray-100 transition"
                href="/lore"
                onClick={() => setOpen(false)}
              >
                📜 Lore
              </Link>
            </nav>
          </div>

          {/* Scrim */}
          <div
            className="nav-scrim"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        </div>
      )}
    </>
  )
}
