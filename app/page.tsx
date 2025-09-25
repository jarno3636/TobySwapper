"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import SwapWidget from "@/components/SwapWidget"

export default function Home() {
  const [showArt, setShowArt] = useState(true)

  return (
    <main className="min-h-screen">
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
              <Link className="pill" href="/links">All ecosystem & contract links →</Link>
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
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="cel-card p-6 md:p-8">
          <SwapWidget />
        </div>
      </section>
    </main>
  )
}
