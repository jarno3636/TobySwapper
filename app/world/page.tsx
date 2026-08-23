"use client";

import Link from "next/link";
import Image from "next/image";
import MiniAppGate from "@/components/MiniAppGate";
import Footer from "@/components/Footer";
import PondDock from "@/components/PondDock";
import WorldAtlas from "@/components/world/WorldAtlas";
import WorldOnboarding from "@/components/world/WorldOnboarding";
import LandExchangePreview from "@/components/world/LandExchangePreview";
import KeeperSpotlight from "@/components/world/KeeperSpotlight";
import WorldPulse from "@/components/world/WorldPulse";
import TobyworldIcon from "@/components/TobyworldIcon";

export default function WorldPage() {
  return (
    <MiniAppGate>
      <main className="world-page mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
        <header className="world-topbar"><Link prefetch={false} href="/">← Tobyworld Community</Link><span>TOBYWORLD · WORLD</span></header>
        <section className="world-hero">
          <div className="world-hero-copy"><span className="land-section-kicker">THE COMMUNITY ATLAS</span><h1>World</h1><p>All 2,869 canonical Lore Lands are open to explore. Study what appeared, follow Keeper-written stories, or simply wander.</p><div className="world-hero-actions"><a href="#atlas">Open the Atlas ↓</a><Link prefetch={false} href="/taboshi1#land">Find my land</Link></div></div>
          <div className="world-hero-art" aria-hidden="true"><span className="world-hero-sun" /><span className="world-island island-a" /><span className="world-island island-b" /><span className="world-island island-c" /><span className="world-river" /><Image src="/tokens/toby.PNG" alt="" width={88} height={88} className="world-hero-frog" /><span className="world-hero-rune">△</span></div>
        </section>

        <nav className="world-section-nav" aria-label="World sections">
          <a href="#pulse"><TobyworldIcon kind="sato" size={32} /><b>Pulse</b><small>What changed</small></a>
          <a href="#keepers"><TobyworldIcon kind="toby" size={32} /><b>Keepers</b><small>Who tends it</small></a>
          <a href="#atlas"><TobyworldIcon kind="lore" size={32} /><b>Atlas</b><small>2,869 lands</small></a>
          <a href="#market"><TobyworldIcon kind="taboshi" size={32} /><b>Market</b><small>Find a deed</small></a>
        </nav>

        <WorldOnboarding />
        <div id="pulse" className="scroll-mt-24"><WorldPulse /></div>
        <div id="keepers" className="scroll-mt-24"><KeeperSpotlight /></div>
        <div id="atlas" className="scroll-mt-24"><WorldAtlas /></div>
        <div id="market" className="scroll-mt-24"><LandExchangePreview /></div>
        <section className="world-official-atlas"><div><span>KEEP EXPLORING</span><h2>The official Tobyworld is one hop away.</h2><p>This community layer sits alongside the world already being revealed.</p></div><a href="https://tobyworld.app/" target="_blank" rel="noreferrer">Visit Tobyworld ↗</a></section>
      </main>
      <Footer />
      <PondDock active="world" />
    </MiniAppGate>
  );
}
