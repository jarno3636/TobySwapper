"use client"

import { useState } from "react"
import Link from "next/link"

export default function MobileNav() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        className="pill md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        title="Menu"
      >
        ☰ Menu
      </button>

      {open && (
        <div className="nav-drawer" role="dialog" aria-modal="true">
          <div className="nav-panel">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-extrabold">Toby Swapper</div>
              <button className="pill" onClick={() => setOpen(false)} aria-label="Close menu">✕</button>
            </div>
            <nav className="grid gap-2">
              <Link className="pill" href="https://toadgod.xyz" target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>Site</Link>
              <Link className="pill" href="https://x.com/toadgod1017" target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>X</Link>
              <Link className="pill" href="https://t.me/toadgang/212753" target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>Telegram</Link>
              <Link className="pill" href="https://basescan.org/address/0x6da391f470a00a206dded0f5fc0f144cae776d7c" target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>Swapper</Link>
            </nav>
          </div>
          <div className="nav-scrim" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  )
}
