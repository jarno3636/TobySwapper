// app/page.tsx
"use client"

import SwapWidget from "@/components/SwapWidget"
import BurnCounter from "@/components/BurnCounter"
import MiniFrog from "@/components/MiniFrog"
import LivePrices from "@/components/LivePrices"
import Portfolio from "@/components/Portfolio"

const BURN_ADDR = "0x000000000000000000000000000000000000dEaD"
const BURN_LINK = `https://basescan.org/address/${BURN_ADDR}`

/** Reusable wrapper gradient card for each section (only card we keep) */
function SectionCard({
  children,
  className = "",
  style,
}: React.PropsWithChildren<{ className?: string; style?: React.CSSProperties }>) {
  return (
    <div
      className={
        "rounded-3xl border-2 border-black relative overflow-hidden p-5 md:p-7 " +
        className
      }
      style={{
        boxShadow: "0 12px 0 #000, 0 26px 56px rgba(0,0,0,.48)",
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* ============================= MAST (Hero) ============================= */}
      <section className="maxw py-16 md:py-20">
        <SectionCard
          style={{
            background:
              "radial-gradient(90% 160% at 0% 0%, rgba(124,58,237,.35), transparent 60%), radial-gradient(120% 180% at 100% 0%, rgba(14,165,233,.30), transparent 60%), linear-gradient(180deg,#0b1020,#0a0f1c)",
          }}
        >
          {/* Centered mascot */}
          <div className="flex justify-center">
            <MiniFrog width={360} height={260} className="mx-auto" />
          </div>

          {/* Title + pills */}
          <div className="mt-6 md:mt-8 grid gap-2 text-center">
            <h1
              className="font-black tracking-tight text-3xl md:text-4xl leading-tight mx-auto"
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

            {/* Cast + BurnCounter + one-liners */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <a
                className="nav-pill"
                href="https://warpcast.com/~/compose?text=Swap.%20Burn.%20Spread%20the%20lore.%20%F0%9F%90%B8%20On%20Base%3A%201%25%20of%20each%20swap%20buys%20%24TOBY%20then%20burns.&embeds[]=https://toadgod.xyz"
                target="_blank"
                rel="noreferrer"
                aria-label="Cast on Farcaster"
              >
                ✨ Cast on Farcaster
              </a>

              {/* Compact BurnCounter beside the cast button */}
              <div className="burn-compact">
                <BurnCounter />
              </div>

              {/* Copy line + flavor lines */}
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
          </div>

          {/* Hide any “updated … ago” line inside the compact BurnCounter */}
          <style jsx global>{`
            .burn-compact .burn-updated,
            .burn-compact .updated,
            .burn-compact .last-updated,
            .burn-compact small,
            .burn-compact time,
            .burn-compact [data-updated],
            .burn-compact .muted,
            .burn-compact .caption {
              display: none !important;
            }
          `}</style>
        </SectionCard>
      </section>

      {/* ============================= SWAP ============================= */}
      <section className="maxw py-16 md:py-20">
        <SectionCard
          className="swap-panel"
          style={{
            background:
              "radial-gradient(60% 140% at 20% 0%, rgba(124,58,237,.28), transparent), radial-gradient(60% 120% at 85% 0%, rgba(14,165,233,.25), transparent), linear-gradient(180deg,#0b1220,#0f172a)",
          }}
        >
          <SwapWidget />
        </SectionCard>
      </section>

      {/* ============================= WALLET ============================= */}
      <section className="maxw py-16 md:py-20">
        <SectionCard
          style={{
            background:
              "radial-gradient(70% 140% at 10% 0%, rgba(34,211,238,.28), transparent), radial-gradient(70% 140% at 90% 0%, rgba(125,211,252,.24), transparent), linear-gradient(180deg,#08131c,#0a1620)",
          }}
        >
          <div
            className="section-title mb-5 text-center"
            style={{ color: "#f6f7fb", textShadow: "0 2px 0 rgba(0,0,0,.3)" }}
          >
            Your Wallet
          </div>
          <Portfolio />
        </SectionCard>
      </section>

      {/* ============================= BURN EXPLAINER ============================= */}
      <section className="maxw py-16 md:py-20">
        <SectionCard
          style={{
            background:
              "radial-gradient(70% 140% at 10% 0%, rgba(255,209,220,.28), transparent), radial-gradient(70% 140% at 90% 0%, rgba(196,181,253,.28), transparent), linear-gradient(180deg,#0f1426,#0c1221)",
          }}
        >
          <div className="text-white/90">
            <div className="font-extrabold text-lg mb-1">Rite of Flame</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>Each swap pays a <b>1% tithe</b> into the Swapper.</li>
              <li>The tithe buys <b>$TOBY</b> via Base’s router.</li>
              <li>Purchased tokens are sent to the burn wallet.</li>
              <li>Irreversible: <b>supply down, signal up</b>.</li>
            </ul>
          </div>
        </SectionCard>
      </section>

      {/* ============================= LIVE PRICES ============================= */}
      <section className="maxw py-16 md:py-24">
        <SectionCard
          style={{
            background:
              "radial-gradient(60% 140% at 85% 0%, rgba(196,181,253,.30), transparent), radial-gradient(60% 140% at 20% 0%, rgba(14,165,233,.28), transparent), linear-gradient(180deg,#0a1323,#0b1220)",
          }}
        >
          <div
            className="section-title mb-5 text-center"
            style={{ color: "#f6f7fb", textShadow: "0 2px 0 rgba(0,0,0,.3)" }}
          >
            Live Prices (via router)
          </div>
          <LivePrices />
        </SectionCard>
      </section>
    </main>
  )
}
