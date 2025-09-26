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
            {artOn ? (
              <MiniFrog onError={() => setArtOn(false)} />
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

      {/* SWAP (light, readable for dark text inside SwapWidget) */}
      <section className="maxw pb-10">
        <div
          className="cel-card p-6 md:p-8"
          data-swap-card
          style={{
            // gentle aqua/lilac glass so the swap card (dark text) stays readable
            background:
              "radial-gradient(70% 120% at 10% 0%, rgba(34,211,238,.28), transparent 60%), radial-gradient(70% 120% at 90% 0%, rgba(196,181,253,.28), transparent 60%), linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,255,255,.9))",
          }}
        >
          <SwapWidget />
        </div>
      </section>

      {/* BURN EXPLAINER (warm gradient) */}
      <section className="maxw pb-10">
        <div
          className="cel-card p-6 md:p-8 grid md:grid-cols-[auto,1fr] gap-5 items-center text-black"
          style={{
            background:
              "radial-gradient(70% 120% at 12% 0%, rgba(255,209,220,.38), transparent 60%), radial-gradient(70% 120% at 88% 10%, rgba(196,181,253,.34), transparent 60%), linear-gradient(180deg, rgba(255,255,255,.95), rgba(255,255,255,.88))",
          }}
        >
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

      {/* YOUR WALLET (minty gradient) */}
      <section className="maxw pb-10">
        <div
          className="cel-card p-6 md:p-8 text-black"
          style={{
            background:
              "radial-gradient(70% 120% at 10% 0%, rgba(121,255,225,.35), transparent 60%), radial-gradient(60% 110% at 90% 10%, rgba(125,211,252,.28), transparent 60%), linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,255,255,.9))",
          }}
        >
          <div className="section-title mb-3">Your Wallet</div>
          <Portfolio />
        </div>
      </section>

      {/* LIVE PRICES (cool lilac/blue gradient) */}
      <section className="maxw pb-16">
        <div
          className="cel-card p-6 md:p-8 text-black"
          style={{
            background:
              "radial-gradient(70% 120% at 85% 0%, rgba(196,181,253,.32), transparent 60%), radial-gradient(60% 120% at 20% 0%, rgba(14,165,233,.28), transparent 60%), linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,255,255,.9))",
          }}
        >
          <div className="section-title mb-3">Live Prices (via router)</div>
          <LivePrices />
        </div>
      </section>
    </main>
  )
}
