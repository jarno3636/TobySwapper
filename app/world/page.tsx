"use client";

import Image from "next/image";
import MiniAppGate from "@/components/MiniAppGate";
import Footer from "@/components/Footer";
import PondDock from "@/components/PondDock";
import WorldAtlas from "@/components/world/WorldAtlas";

export default function WorldPage() {
  return (
    <MiniAppGate>
      <main className="world-page mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
        <header className="world-topbar"><a href="/taboshi1">← My Tobyworld</a><span>TOBYWORLD · WORLD</span></header>
        <section className="world-hero">
          <div className="world-hero-copy"><span className="land-section-kicker">THE COMMUNITY ATLAS</span><h1>World</h1><p>Every deed can become a place worth visiting. Wander named lands, follow community trails, or open any Lore Deed by number.</p><div className="world-hero-actions"><a href="#atlas">Explore lands ↓</a><a href="/taboshi1#land">Find my land</a></div></div>
          <div className="world-hero-art" aria-hidden="true"><span className="world-hero-sun" /><span className="world-island island-a" /><span className="world-island island-b" /><span className="world-island island-c" /><span className="world-river" /><Image src="/tokens/toby.PNG" alt="" width={88} height={88} className="world-hero-frog" /><span className="world-hero-rune">△</span></div>
        </section>
        <div id="atlas" className="scroll-mt-24"><WorldAtlas /></div>
        <section className="world-official-atlas"><div><span>KEEP EXPLORING</span><h2>The official Tobyworld is one hop away.</h2><p>This community layer sits alongside the world already being revealed.</p></div><a href="https://tobyworld.app/" target="_blank" rel="noreferrer">Visit Tobyworld ↗</a></section>
      </main>
      <Footer />
      <PondDock active="world" />
    </MiniAppGate>
  );
}
