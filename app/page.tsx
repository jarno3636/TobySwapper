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
      {/* MAST (small, moody, no giant explainer) */}
      <section className="maxw pt-4 pb-10">
        <div
          className="rounded-3xl border-2 border-black p-4 md:p-6 relative overflow-hidden"
          style={{
            background:
              "radial-gradient(90% 160% at 0% 0%, rgba(124,58,237,.35), transparent 60%), radial-gradient(120% 180% at 100% 0%, rgba(14,165,233,.30), transparent 60%), linear-gradient(180deg, #0b1020, #0a0f1c)",
            boxShadow: "0 10px 0 #000, 0 22px 50px rgba(0,0,0,.45)",
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {artOn ? (
                <div className="shrink-0">
                  <MiniFrog onError={() => setArtOn(false)} />
                </div>
              ) : (
                <div className="shrink-0 w-[340px] h-[220px] rounded-2xl border-2 border-black bg-black/20" />
              )}
              <div className="grid gap-1">
                <h1 className="font-black tracking-tight text-2xl sm:text-3xl md:text-4xl leading-tight"
                    style={{
                      background: "linear-gradient(90deg,#a78bfa 0%,#79ffe1 50%,#93c5fd 100%)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                      textShadow: "0 2px 0 rgba(0,0,0,.25)",
                    }}>
                  Bright, bouncy swaps on Base
                </h1>
                <p className="text-white/85 text-sm md:text-base">
                  1% of every swap auto-buys <b>$TOBY</b> and sends it to <code className="pill">0x…dEaD</code>.
                </p>
              </div>
            </div>

            <div className="hidden md:block">
              <BurnCounter />
            </div>
          </div>
        </div>
      </section>

      {/* SWAP — dark shell with crisp inner panel for perfect contrast */}
      <section className="maxw pb-14">
        <div
          className="rounded-3xl border-2 border-black p-3 md:p-4 relative overflow-hidden"
          style={{
            background:
              "radial-gradient(60% 140% at 20% 0%, rgba(124,58,237,.28), transparent), radial-gradient(60% 120% at 85% 0%, rgba(14,165,233,.25), transparent), linear-gradient(180deg,#0b1220,#0f172a)",
            boxShadow: "0 10px 0 #000, 0 22px 50px rgba(0,0,0,.45)",
          }}
        >
          <div className="cel-card p-6 md:p-8 !bg-white">
            <SwapWidget />
          </div>

          {/* actions row under the card */}
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              className="nav-pill"
              href="https://warpcast.com/~/compose?text=Swapping%20on%20Toby%20Swapper%20%F0%9F%94%A5%20(1%25%20auto-buys%20%24TOBY%20%F0%9F%94%A5)&embeds[]=https://toadgod.xyz"
              target="_blank"
              rel="noreferrer"
            >
              ✨ Share on Farcaster
            </a>
            <Link className="nav-pill" href="/lore">📚 Lore & Contracts</Link>
          </div>
        </div>
      </section>

      {/* BURN — dark, warm gradient with white micro-panels */}
      <section className="maxw pb-14">
        <div
          className="rounded-3xl border-2 border-black p-6 md:p-8 relative overflow-hidden"
          style={{
            background:
              "radial-gradient(70% 140% at 10% 0%, rgba(255,209,220,.28), transparent), radial-gradient(70% 140% at 90% 0%, rgba(196,181,253,.28), transparent), linear-gradient(180deg,#0f1426,#0c1221)",
            boxShadow: "0 10px 0 #000, 0 22px 50px rgba(0,0,0,.45)",
          }}
        >
          <div className="grid md:grid-cols-[auto,1fr] gap-6 items-center">
            <div className="cel-card p-4 !bg-white">
              <BurnCounter />
            </div>

            <div className="cel-card p-4 !bg-white text-black/85">
              <div className="font-extrabold text-black text-lg mb-1">What happens under the hood?</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Every swap takes a <b>1% fee</b> (inside the Swapper contract).</li>
                <li>That 1% routes through Base’s router to <b>buy $TOBY</b>.</li>
                <li>Purchased $TOBY is sent to the burn wallet <code className="pill">0x…dEaD</code>.</li>
                <li>Burns are permanent. <b>Supply down, vibes up.</b> 🔥</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* WALLET — deep teal gradient wrapper */}
      <section className="maxw pb-14">
        <div
          className="rounded-3xl border-2 border-black p-6 md:p-8 relative overflow-hidden"
          style={{
            background:
              "radial-gradient(70% 140% at 10% 0%, rgba(34,211,238,.28), transparent), radial-gradient(70% 140% at 90% 0%, rgba(125,211,252,.24), transparent), linear-gradient(180deg,#08131c,#0a1620)",
            boxShadow: "0 10px 0 #000, 0 22px 50px rgba(0,0,0,.45)",
          }}
        >
          <div className="section-title mb-4" style={{ color: "#f6f7fb", textShadow: "0 2px 0 rgba(0,0,0,.3)" }}>
            Your Wallet
          </div>
          {/* Portfolio already renders colorful sub-cards */}
          <div className="cel-card p-4 !bg-white/98">
            <Portfolio />
          </div>
        </div>
      </section>

      {/* LIVE PRICES — royal blue/lilac gradient */}
      <section className="maxw pb-20">
        <div
          className="rounded-3xl border-2 border-black p-6 md:p-8 relative overflow-hidden"
          style={{
            background:
              "radial-gradient(60% 140% at 85% 0%, rgba(196,181,253,.30), transparent), radial-gradient(60% 140% at 20% 0%, rgba(14,165,233,.28), transparent), linear-gradient(180deg,#0a1323,#0b1220)",
            boxShadow: "0 10px 0 #000, 0 22px 50px rgba(0,0,0,.45)",
          }}
        >
          <div className="section-title mb-4" style={{ color: "#f6f7fb", textShadow: "0 2px 0 rgba(0,0,0,.3)" }}>
            Live Prices (via router)
          </div>
          <div className="cel-card p-4 !bg-white/98">
            <LivePrices />
          </div>
        </div>
      </section>
    </main>
  )
}
