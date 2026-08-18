"use client";

import Image from "next/image";
import MiniAppGate from "@/components/MiniAppGate";
import Footer from "@/components/Footer";
import PondDock from "@/components/PondDock";

export default function LandExchangePage() {
  return (
    <MiniAppGate>
      <main className="exchange-page mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
        <header className="world-topbar"><a href="/world">← World</a><span>TOBYWORLD · LAND EXCHANGE</span></header>

        <section className="exchange-hero">
          <div className="exchange-hero-copy"><span className="land-section-kicker">THE MARKET GATE</span><h1>Land Exchange</h1><p>A quiet place being prepared for Lore Land discovery, listings, and trade.</p><div className="exchange-hero-actions"><a href="/world">Explore World</a><a href="/taboshi1#land">My Land</a></div></div>
          <div className="exchange-hero-art" aria-hidden="true"><span className="exchange-gate-ring r1" /><span className="exchange-gate-ring r2" /><span className="exchange-gate-rune">△</span><Image src="/tokens/toby.PNG" alt="" width={86} height={86} className="exchange-frog" /></div>
        </section>

        <section className="exchange-shell">
          <div className="exchange-shell-head"><div><span>LAND LISTINGS</span><h2>The gate is not open yet.</h2></div><span className="exchange-status">PREPARING</span></div>
          <div className="exchange-toolbar" aria-hidden="true"><div>Search deed # or place</div><div>All lands⌄</div><div>Price⌄</div></div>
          <div className="exchange-empty">
            <div className="exchange-empty-icon"><span>△</span></div>
            <h3>No listings are being accepted yet.</h3>
            <p>For now, Lore Land remains about ownership, identity, and exploration. The exchange can wake when the real market rules are known.</p>
            <div><a href="/world">Explore community lands</a><a href="/taboshi1#land">Open my land</a></div>
          </div>
        </section>
      </main>
      <Footer />
      <PondDock active="world" />
    </MiniAppGate>
  );
}
