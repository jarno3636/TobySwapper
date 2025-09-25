"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import BurnCounter from "@/components/BurnCounter"
import SwapWidget from "@/components/SwapWidget"
import ThemeToggle from "@/components/ThemeToggle"
import MobileNav from "@/components/MobileNav"

export default function Home() {
  const [showArt, setShowArt] = useState(true)

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/toby-logo.svg" alt="TOBY" width={52} height={52} />
          <div className="text-3xl font-extrabold tracking-tight">Toby Swapper</div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <BurnCounter />
          <nav className="hidden md:flex gap-3">
            <Link className="pill" href="https://toadgod.xyz" target="_blank" rel="noreferrer">Site</Link>
            <Link className="pill" href="https://x.com/toadgod1017" target="_blank" rel="noreferrer">X</Link>
            <Link className="pill" href="https://t.me/toadgang/212753" target="_blank" rel="noreferrer">Telegram</Link>
          </nav>
          <MobileNav />
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-8">
        <div className="hero">
          <div className="hero-copy">
            <h1 className="hero-title">Bright, bouncy swaps on Base</h1>
            <p className="hero-sub">
              Swap <b>USDC/ETH</b> ↔ <b>TOBY, PATIENCE, TABOSHI</b>. A built-in 1% fee auto-buys
              TOBY and burns it to <code className="pill">0x…dEaD</code>.
            </p>
            <div className="flex flex-wrap gap-2">
              <a className="pill" href="https://basescan.org/address/0xb8D98a102b0079B69FFbc760C8d857A31653e56e" target="_blank" rel="noreferrer">$TOBY</a>
              <a className="pill" href="https://basescan.org/address/0x6D96f18F00B815B2109A3766E79F6A7aD7785624" target="_blank" rel="noreferrer">$PATIENCE</a>
              <a className="pill" href="https://basescan.org/address/0x3a1a33cf4553db61f0db2c1e1721cd480b02789f" target="_blank" rel="noreferrer">$TABOSHI</a>
              <a className="pill" href="https://basescan.org/token/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" target="_blank" rel="noreferrer">USDC on Base</a>
            </div>
          </div>

          <div className="hero-art">
            {showArt ? (
              <Image
                src="/toby-hero.png"
                alt="Toby art"
                width={420}
                height={320}
                className="drop-shadow-xl rounded-2xl"
                onError={() => setShowArt(false)}
                priority
              />
            ) : (
              <div className="hero-fallback">
                <div className="hero-fallback-inner">TOBY</div>
              </div>
            )}
          </div>

          <div className="blob blob-1" />
          <div className="blob blob-2" />
        </div>
      </section>

      {/* Main */}
      <section className="mx-auto max-w-6xl px-4 pb-20 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 cel-card p-6 md:p-8">
          <SwapWidget />
        </div>

        <aside className="cel-card p-6 md:p-8 space-y-4">
          <div className="section-title">Ecosystem</div>
          <p className="text-sm text-black/80">Official links and contracts for the TobyWorld ecosystem.</p>

          <ul className="space-y-2 text-sm text-black/85">
            <li><a className="pill" href="https://toadgod.xyz" target="_blank" rel="noreferrer">Creator Website</a></li>
            <li><a className="pill" href="https://x.com/toadgod1017" target="_blank" rel="noreferrer">Creator on X</a></li>
            <li><a className="pill" href="https://t.me/toadgang/212753" target="_blank" rel="noreferrer">Toby Telegram</a></li>
          </ul>

          <div className="divider" />

          <div className="grid gap-2">
            <div className="section-title">Contracts</div>
            <ul className="space-y-2 text-xs text-black/80">
              <li><a className="pill" href="https://basescan.org/address/0xb8D98a102b0079B69FFbc760C8d857A31653e56e" target="_blank" rel="noreferrer">$TOBY</a></li>
              <li><a className="pill" href="https://basescan.org/address/0x6D96f18F00B815B2109A3766E79F6A7aD7785624" target="_blank" rel="noreferrer">$PATIENCE</a></li>
              <li><a className="pill" href="https://basescan.org/address/0x3a1a33cf4553db61f0db2c1e1721cd480b02789f" target="_blank" rel="noreferrer">$TABOSHI</a></li>
              <li><a className="pill" href="https://basescan.org/token/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" target="_blank" rel="noreferrer">USDC</a></li>
            </ul>
          </div>

          <p className="text-xs text-black/60">
            The 1% fee is handled on-chain by the Swapper contract and routed to buy TOBY then burn to 0x…dEaD.
          </p>
        </aside>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-4 pb-10 flex flex-col sm:flex-row items-center gap-3 justify-between text-sm text-white/70">
        <div>Built for the <b>TobyWorld</b> community. ✨</div>
        <div className="flex flex-wrap gap-3">
          <a className="pill" href="https://basescan.org/address/0x6da391f470a00a206dded0f5fc0f144cae776d7c" target="_blank" rel="noreferrer">Swapper Contract</a>
          <a className="pill" href="https://basescan.org/address/0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24" target="_blank" rel="noreferrer">Router</a>
        </div>
      </footer>
    </main>
  )
}
