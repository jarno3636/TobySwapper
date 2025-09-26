// app/page.tsx
"use client"

import { useState } from "react"
import SwapWidget from "@/components/SwapWidget"
import BurnCounter from "@/components/BurnCounter"
import MiniFrog from "@/components/MiniFrog"
import LivePrices from "@/components/LivePrices"
import Portfolio from "@/components/Portfolio"

const BURN_ADDR = "0x000000000000000000000000000000000000dEaD"
const BURN_LINK = `https://basescan.org/address/${BURN_ADDR}`

export default function Home() {
  const [artOn, setArtOn] = useState(true)

  return (
    <main className="min-h-screen">
      {/* MAST — moody, compact hero */}
      <section className="maxw pt-6 pb-16">
        <div
          className="rounded-3xl border-2 border-black p-5 md:p-7 relative overflow-hidden"
          style={{
            background:
              "radial-gradient(90% 160% at 0% 0%, rgba(124,58,237,.35), transparent 60%), radial-gradient(120% 180% at 100% 0%, rgba(14,165,233,.30), transparent 60%), linear-gradient(180deg, #0b1020, #0a0f1c)",
            boxShadow: "0 12px 0 #000, 0 26px 56px rgba(0,0,0,.48)",
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              {artOn ? (
                <div className="shrink-0">
                  <MiniFrog onError={() => setArtOn(false)} />
                </div>
              ) : (
                <div className="shrink-0 w-[340px] h-[220px] rounded-2xl border-2 border-black bg-black/20" />
              )}

              <div className="grid gap-2">
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
                  Swap. Burn. Spread the lore.
                </h1>
                <p className="text-white/85 text-sm md:text-base">
                  Every trade feeds the flame and strengthens the signal.
                </p>

                {/* Cast + Burn + Lore one-liners */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a
                    className="nav-pill"
                    href="https://warpcast.com/~/compose?text=Swap.%20Burn.%20Spread%20the%20lore.%20%F0%9F%90%B8%20On%20Base%3A%201%25%20of%20each%20swap%20buys%20%24TOBY%20then%20burns.&embeds[]=https://toadgod.xyz"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Cast on Farcaster"
                  >
                    ✨ Cast on Farcaster
                  </a>

                  {/* BurnCounter inline beside the cast button */}
                  <div className="hidden sm:block">
                    <BurnCounter />
                  </div>

                  {/* Single copy-friendly burn line, with linked “Dead wallet” */}
                  <span className="pill pill--muted">
                    1% burn sent to{" "}
                    <a
                      href={BURN_LINK}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                      title="View burn wallet on BaseScan"
                    >
                      Dead wallet
                    </a>
                  </span>

                  <span className="pill pill--muted">Endless summers are near.</span>
                  <span className="pill pill--muted">Patience must persevere.</span>
                </div>

                {/* BurnCounter visible on very small screens (stacked) */}
                <div className="sm:hidden mt-2">
                  <BurnCounter />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SWAP — dark shell with crisp content card */}
      <section className="maxw pb-20">
        <div
          className="rounded-3xl border-2 border-black p-4 md:p-5 relative overflow-hidden"
          style={{
            background:
              "radial-gradient(60% 140% at 20% 0%, rgba(124,58,237,.28), transparent), radial-gradient(60% 120% at 85% 0%, rgba(14,165,233,.25), transparent), linear-gradient(180deg,#0b1220,#0f172a)",
            boxShadow: "0 12px 0 #000, 0 26px 56px rgba(0,0,0,.48)",
          }}
        >
          <div className="cel-card cel-card--content p-6 md:p-8">
            <SwapWidget />
          </div>
          {/* (Removed the mid-page Lore & Contracts button per request) */}
        </div>
      </section>

      {/* WALLET — directly after the swapper */}
      <section className="maxw pb-20">
        <div
          className="rounded-3xl border-2 border-black p-6 md:p-8 relative overflow-hidden"
          style={{
            background:
              "radial-gradient(70% 140% at 10% 0%, rgba(34,211,238,.28), transparent), radial-gradient(70% 140% at 90% 0%, rgba(125,211,252,.24), transparent), linear-gradient(180deg,#08131c,#0a1620)",
            boxShadow: "0 12px 0 #000, 0 26px 56px rgba(0,0,0,.48)",
          }}
        >
          <div className="section-title mb-5" style={{ color: "#f6f7fb", textShadow: "0 2px 0 rgba(0,0,0,.3)" }}>
            Your Wallet
          </div>
          <div className="cel-card cel-card--content p-5">
            <Portfolio />
          </div>
        </div>
      </section>

      {/* BURN — compact explainer */}
      <section className="maxw pb-20">
        <div
          className="rounded-3xl border-2 border-black p-6 md:p-8 relative overflow-hidden"
          style={{
            background:
              "radial-gradient(70% 140% at 10% 0%, rgba(255,209,220,.28), transparent), radial-gradient(70% 140% at 90% 0%, rgba(196,181,253,.28), transparent), linear-gradient(180deg,#0f1426,#0c1221)",
            boxShadow: "0 12px 0 #000, 0 26px 56px rgba(0,0,0,.48)",
          }}
        >
          <div className="grid md:grid-cols-[auto,1fr] gap-6 items-center">
            <div className="cel-card cel-card--content p-4">
              <BurnCounter />
            </div>

            <div className="cel-card cel-card--content p-5 text-black/85">
              <div className="font-extrabold text-black text-lg mb-1">Rite of Flame</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Each swap pays a <b>1% tithe</b> into the Swapper.</li>
                <li>The tithe buys <b>$TOBY</b> via Base’s router.</li>
                <li>Purchased tokens are sent to the burn wallet.</li>
                <li>Irreversible: <b>supply down, signal up</b>.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE PRICES */}
      <section className="maxw pb-24">
        <div
          className="rounded-3xl border-2 border-black p-6 md:p-8 relative overflow-hidden"
          style={{
            background:
              "radial-gradient(60% 140% at 85% 0%, rgba(196,181,253,.30), transparent), radial-gradient(60% 140% at 20% 0%, rgba(14,165,233,.28), transparent), linear-gradient(180deg,#0a1323,#0b1220)",
            boxShadow: "0 12px 0 #000, 0 26px 56px rgba(0,0,0,.48)",
          }}
        >
          <div className="section-title mb-5" style={{ color: "#f6f7fb", textShadow: "0 2px 0 rgba(0,0,0,.3)" }}>
            Live Prices (via router)
          </div>
          <div className="cel-card cel-card--content p-5">
            <LivePrices />
          </div>
        </div>
      </section>
    </main>
  )
}
