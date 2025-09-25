"use client"

import Image from "next/image"
import Link from "next/link"
import BurnCounter from "@/components/BurnCounter"
import SwapWidget from "@/components/SwapWidget"

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/toby-logo.svg" alt="TOBY" width={52} height={52} />
          <div className="text-3xl font-extrabold tracking-tight">Toby Swapper</div>
        </div>
        <div className="flex items-center gap-4">
          <BurnCounter />
          <nav className="hidden sm:flex gap-4">
            <Link className="pill" href="https://toadgod.xyz" target="_blank" rel="noreferrer">Site</Link>
            <Link className="pill" href="https://x.com/toadgod1017" target="_blank" rel="noreferrer">X</Link>
            <Link className="pill" href="https://t.me/toadgang/212753" target="_blank" rel="noreferrer">Telegram</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-20 grid md:grid-cols-2 gap-8">
        <div className="cel-card p-6 md:p-8">
          <div className="section-title mb-4">Swap</div>
          <SwapWidget />
        </div>

        <aside className="cel-card p-6 md:p-8">
          <div className="section-title mb-3">Ecosystem Links</div>
          <ul className="space-y-2 text-sm text-black/80">
            <li><a className="pill" href="https://basescan.org/address/0xb8D98a102b0079B69FFbc760C8d857A31653e56e" target="_blank" rel="noreferrer">$TOBY Contract</a></li>
            <li><a className="pill" href="https://basescan.org/address/0x6D96f18F00B815B2109A3766E79F6A7aD7785624" target="_blank" rel="noreferrer">$PATIENCE Contract</a></li>
            <li><a className="pill" href="https://basescan.org/address/0x3a1a33cf4553db61f0db2c1e1721cd480b02789f" target="_blank" rel="noreferrer">$TABOSHI Contract</a></li>
            <li><a className="pill" href="https://basescan.org/token/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" target="_blank" rel="noreferrer">USDC on Base</a></li>
          </ul>
          <div className="mt-6 text-xs text-black/60">
            1% fee is auto-routed by the contract to buy TOBY and burn to 0x…dEaD.
          </div>
        </aside>
      </section>
    </main>
  )
}
