// app/page.tsx
"use client"

import Link from "next/link"
import { useState } from "react"
import SwapWidget from "@/components/SwapWidget"
import BurnCounter from "@/components/BurnCounter"
import MiniFrog from "@/components/MiniFrog"
import LivePrices from "@/components/LivePrices"
import Portfolio from "@/components/Portfolio"

export default function Home() {
  const [artOn, setArtOn] = useState(true)

  return (
    <main className="min-h-screen">
      {/* HERO */}
      <section className="maxw pb-8">
        <div className="hero">
          <div className="hero-copy">
            <h1 className="hero-title">Bright, bouncy swaps on Base</h1>
            <p className="hero-sub">
              Swap <b>USDC/ETH</b> ↔ <b>TOBY, PATIENCE, TABOSHI</b>. A built-in 1% fee auto-buys
              TOBY and sends it to <code className="pill">0x…dEaD</code>. Clean routes, fair quotes, colorful vibes.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link className="pill" href="/lore">All ecosystem & contract lore →</Link>
            </div>
          </div>

          <div className="hero-art flex items-center justify-center">
            {artOn ? <MiniFrog onError={() => setArtOn(false)} /> : <div className="hero-fallback"><div className="hero-fallback-inner">TOBY</div></div>}
          </div>

          <div className="blob blob-1" />
          <div className="blob blob-2" />
        </div>
      </section>

      {/* SWAP */}
      <section className="maxw pb-10">
        <div className="cel-card p-6 md:p-8" data-swap-card>
          <SwapWidget />
        </div>
      </section>

      {/* BURN EXPLAINER */}
      <section className="maxw pb-10">
        <div className="cel-card p-6 md:p-8 grid md:grid-cols-[auto,1fr] gap-5 items-center">
          <div><BurnCounter /></div>
          <div className="text-black/80 text-sm leading-relaxed">
            <div className="font-extrabold text-black text-lg mb-1">What happens under the hood?</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>Every swap takes a <b>1% fee</b> (inside the Swapper contract).</li>
              <li>That 1% is routed via Base’s router to <b>buy $TOBY</b>.</li>
              <li>Purchased $TOBY is sent to the burn wallet <code className="pill">0x…dEaD</code>.</li>
              <li>Burns are permanent. <b>Supply down, vibes up.</b> 🔥</li>
            </ul>
          </div>
        </div>
      </section>

      {/* YOUR WALLET */}
      <section className="maxw pb-10">
        <div className="cel-card p-6 md:p-8">
          <div className="section-title mb-3">Your Wallet</div>
          <Portfolio />
        </div>
      </section>

      {/* LIVE PRICES */}
      <section className="maxw pb-16">
        <div className="cel-card p-6 md:p-8">
          <div className="section-title mb-3">Live Prices (via router)</div>
          <LivePrices />
        </div>
      </section>
    </main>
  )
}
