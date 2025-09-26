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
      {/* MAST — moody, compact, premium */}
      <section className="maxw pt-4 pb-12">
        <div
          className="rounded-3xl border-2 border-black p-4 md:p-6 relative overflow-hidden"
          style={{
            background:
              "radial-gradient(90% 160% at 0% 0%, rgba(124,58,237,.35), transparent 60%), radial-gradient(120% 180% at 100% 0%, rgba(14,165,233,.30), transparent 60%), linear-gradient(180deg, #0b1020, #0a0f1c)",
            boxShadow: "0 10px 0 #000, 0 22px 50px rgba(0,0,0,.45)",
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              {artOn ? (
                <div className="shrink-0">
                  <MiniFrog onError={() => setArtOn(false)} />
                </div>
              ) : (
                <div className="shrink-0 w-[340px] h-[220px] rounded-2xl border-2 border-black bg-black/20" />
              )}
              <div className="grid gap-1">
                <h1
                  className="font-black tracking-tight text-2xl sm:text-3xl md:text-4xl leading-tight"
                  style={{
                    background: "linear-gradient(90deg,#a78bfa 0%,#79ffe1 50%,#93c5fd 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    textShadow: "0 2px 0 rgba(0,0,0,.25)",
                  }}
                >
                  Swap. Burn. Croak.
                </h1>
                <p className="text-white/85 text-sm md:text-base">
                  1% of every swap auto-buys <b>$TOBY</b> and consigns it to{" "}
                  <code className="pill pill--muted">0x…dEaD</code>.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link className="nav-pill" href="/lore">📚 Lore & Contracts</Link>
                  <a
                    className="nav-pill"
                    href="https://warpcast.com/~/compose?text=Swapping%20on%20Toby%20Swapper%20%F0%9F%90%B8%20(1%25%20auto-buys%20%24TOBY%20to%200x%E2%80%A6dEaD)&embeds[]=https://toadgod.xyz"
                    target="_blank" rel="noreferrer"
                  >
                    ✨ Cast on Farcaster
                  </a>
                </div>
              </div>
            </div>

            <div className="hidden md:block">
              <BurnCounter />
            </div>
          </div>
        </div>
      </section>

      {/* SWAP — dark shell with crisp content card */}
      <section className="maxw pb-10">
        <div
          className="rounded-3xl border-2 border-black p-3 md:p-4 relative overflow-hidden"
          style={{
            background:
              "radial-gradient(60% 140% at 20% 0%, rgba(124,58,237,.28), transparent), radial-gradient(60% 120% at 85% 0%, rgba(14,165,233,.25), transparent), linear-gradient(180deg,#0b1220,#0f172a)",
            boxShadow: "0 10px 0 #000, 0 22px 50px rgba(0,0,0,.45)",
          }}
        >
          <div className="cel-card cel-card--content p-6 md:p-8">
            <SwapWidget />
          </div>

          {/* micro actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              className="nav-pill"
              href="https://warpcast.com/~/compose?text=Route%20clean%2C%20burn%20mean.%20%F0%9F%94%A5%20Swap%20%E2%86%92%201%25%20buys%20%24TOBY%20%E2%86%92%200x%E2%80%A6dEaD"
              target="_blank" rel="noreferrer"
            >
              🔁 Share your route
            </a>
            <Link className="nav-pill" href="/lore">🛕 Read the Codex</Link>
          </div>
        </div>
      </section>

      {/* WALLET — placed directly after the swapper */}
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
          <div className="cel-card cel-card--content p-4">
            <Portfolio />
          </div>
        </div>
      </section>

      {/* BURN — concise, warm gradient with compact explainer */}
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
            <div className="cel-card cel-card--content p-4">
              <BurnCounter />
            </div>

            <div className="cel-card cel-card--content p-4 text-black/85">
              <div className="font-extrabold text-black text-lg mb-1">Rite of Flame</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Each swap pays a <b>1% tithe</b> into the Swapper.</li>
                <li>The tithe buys <b>$TOBY</b> via Base’s router.</li>
                <li>Purchased tokens are sent to <code className="pill pill--muted">0x…dEaD</code>.</li>
                <li>Irreversible: <b>supply down, signal up</b>.</li>
              </ul>
            </div>
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
          <div className="cel-card cel-card--content p-4">
            <LivePrices />
          </div>
        </div>
      </section>
    </main>
  )
}
