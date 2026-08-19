"use client";

import Image from "next/image";
import MiniAppGate from "@/components/MiniAppGate";
import Footer from "@/components/Footer";
import PondDock from "@/components/PondDock";
import MarketplaceShell from "@/components/world/MarketplaceShell";

export default function LandExchangePage() {
  return (
    <MiniAppGate>
      <main className="exchange-page mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
        <header className="world-topbar"><a href="/world">← World</a><span>TOBYWORLD · MARKET</span></header>
        <section className="exchange-hero exchange-hero-clean">
          <div className="exchange-hero-copy"><span className="land-section-kicker">THE MARKET GATE</span><h1>Tobyworld Market</h1><p>Buy, sell, and signal what you are looking for across SEED, Old Lore Land, and Canonical Lore Land — all on Base.</p><div className="exchange-hero-actions"><a href="#market">Browse market ↓</a><a href="/taboshi1#pouch">My assets</a></div></div>
          <div className="exchange-hero-art" aria-hidden="true"><span className="exchange-gate-ring r1" /><span className="exchange-gate-ring r2" /><span className="exchange-gate-rune">△</span><Image src="/seed.png" alt="" width={78} height={78} className="exchange-seed" /><Image src="/tokens/toby.PNG" alt="" width={72} height={72} className="exchange-frog" /></div>
        </section>
        <div id="market" className="scroll-mt-24"><MarketplaceShell /></div>
      </main>
      <Footer />
      <PondDock active="market" />
    </MiniAppGate>
  );
}
