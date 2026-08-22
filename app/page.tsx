"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import MiniAppGate from "@/components/MiniAppGate";
import SwapForm from "@/components/SwapForm";
import Footer from "@/components/Footer";
import ShareCallout from "@/components/ShareCallout";
import PondDock from "@/components/PondDock";
import TobyworldAssets from "@/components/TobyworldAssets";

const TokensBurned = dynamic(() => import("@/components/TokensBurned"), { ssr: false });

function HeroArtwork() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const readTheme = () => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    readTheme();
    window.addEventListener("tobyswap:theme-change", readTheme);
    return () => window.removeEventListener("tobyswap:theme-change", readTheme);
  }, []);

  return <Image src={theme === "dark" ? "/ui/tobyswap-hero-dark.webp" : "/ui/tobyswap-hero.webp"} alt="Tobyworld community pond" width={1536} height={1024} className="community-home-art" priority sizes="(max-width: 640px) 100vw, 1152px" />;
}

export default function Page() {
  return (
    <MiniAppGate>
      <div className="community-home mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
        <section className="community-home-hero">
          <div className="community-home-visual"><HeroArtwork /><span className="community-home-veil" /></div>
          <div className="community-home-copy">
            <span className="land-section-kicker">TOBYWORLD · COMMUNITY</span>
            <h1>A world to visit, keep and study.</h1>
            <p>Explore all 2,869 canonical Lore Lands, write the story of a place you keep, study the signs that appeared, and carry Tobyworld assets through the pond.</p>
            <div className="community-home-actions">
              <Link prefetch={false} href="/world" className="community-home-primary"><span>◎</span><div><strong>Enter the World</strong><small>Atlas · Wander · canonical signs</small></div><b>→</b></Link>
              <Link prefetch={false} href="/taboshi1" className="community-home-action"><span>△</span><div><strong>My Tobyworld</strong><small>Land · pouch · Keeper Mark</small></div><b>→</b></Link>
              <Link prefetch={false} href="/keepers" className="community-home-action"><span>◌</span><div><strong>Meet the Keepers</strong><small>Community-written identity & legacy</small></div><b>→</b></Link>
            </div>
          </div>
        </section>

        <section className="community-home-paths">
          <Link prefetch={false} href="/world" className="community-path-card"><span>WORLD ATLAS</span><strong>2,869 places are open</strong><p>Visit every canonical Lore Land whether or not its keeper has customized it.</p><b>Explore →</b></Link>
          <Link prefetch={false} href="/world?wander=1" className="community-path-card"><span>WANDER</span><strong>Follow an unexpected trail</strong><p>Jump into a random canonical land. No points, no streak, just exploration.</p><b>Wander →</b></Link>
          <Link prefetch={false} href="/world/exchange" className="community-path-card"><span>THE MARKET</span><strong>Find a way into the world</strong><p>Browse Lore Deed listings or leave a buy request without turning the World into a closed gate.</p><b>Find a deed →</b></Link>
        </section>

        <TobyworldAssets />

        <section id="swap" className="pond-utility-shell scroll-mt-24">
          <div className="pond-utility-intro">
            <span className="pond-utility-icon"><Image src="/tokens/patience.PNG" alt="PATIENCE" fill sizes="62px" className="object-contain" /></span>
            <div><span className="land-section-kicker">POND UTILITY</span><h2>Need to swap?</h2><p>The swap remains here as a tool inside the wider Tobyworld community experience.</p></div>
          </div>
          <details className="pond-utility-details">
            <summary><span>Open swap utility</span><b>TOBY · PATIENCE · TABOSHI</b><i>⌄</i></summary>
            <div className="pond-utility-body">
              <SwapForm />
              <div className="mt-3"><ShareCallout token="$TOBY" /></div>
              <TokensBurned />
            </div>
          </details>
        </section>
      </div>
      <Footer />
      <PondDock active="world" />
    </MiniAppGate>
  );
}
