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
            <p>Explore all 2,869 canonical Lore Lands, follow Keeper-written stories, study the signs that appeared, and carry Tobyworld assets through the pond.</p>
            <div className="community-home-actions community-home-actions-refined">
              <Link prefetch={false} href="/world" className="community-home-primary"><span>◎</span><div><strong>Enter the World</strong><small>Atlas · Wander · discovery</small></div><b>→</b></Link>
              <Link prefetch={false} href="/taboshi1" className="community-home-action"><span>△</span><div><strong>My Tobyworld</strong><small>Land · pouch · Keeper Mark</small></div><b>→</b></Link>
            </div>
            <nav className="community-home-quicklinks" aria-label="Explore Tobyworld">
              <Link prefetch={false} href="/world?wander=1">Wander</Link>
              <Link prefetch={false} href="/keepers">Meet Keepers</Link>
              <Link prefetch={false} href="/world/exchange">Find a Deed</Link>
            </nav>
          </div>
        </section>

        <section className="community-home-wayfinder" aria-label="Tobyworld paths">
          <div className="community-home-wayfinder-copy"><span className="land-section-kicker">FIND YOUR WAY</span><h2>Start with the part of Tobyworld you came for.</h2><p>The World is the destination. Your land, the community and pond utilities connect back into it.</p></div>
          <div className="community-home-wayfinder-links">
            <Link prefetch={false} href="/world"><span>01</span><div><strong>Explore</strong><small>All canonical lands</small></div><b>→</b></Link>
            <Link prefetch={false} href="/taboshi1"><span>02</span><div><strong>Keep</strong><small>Your land & pouch</small></div><b>→</b></Link>
            <Link prefetch={false} href="/keepers"><span>03</span><div><strong>Connect</strong><small>Stories & keepers</small></div><b>→</b></Link>
          </div>
        </section>

        <TobyworldAssets />

        <section id="swap" className="pond-utility-shell scroll-mt-24">
          <div className="pond-utility-intro">
            <span className="pond-utility-icon"><Image src="/tokens/patience.PNG" alt="PATIENCE" fill sizes="62px" className="object-contain" /></span>
            <div><span className="land-section-kicker">POND UTILITY</span><h2>Swap when you need it.</h2><p>A compact utility inside the wider Tobyworld experience—not the reason the rest of the World exists.</p></div>
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
