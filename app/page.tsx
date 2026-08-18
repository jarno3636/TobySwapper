"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import MiniAppGate from "@/components/MiniAppGate";
import SwapForm from "@/components/SwapForm";
import Footer from "@/components/Footer";
import ShareCallout from "@/components/ShareCallout";
import WorldLinks from "@/components/WorldLinks";
import PondDock from "@/components/PondDock";

const TokensBurned = dynamic(() => import("@/components/TokensBurned"), { ssr: false });

export default function Page() {
  return (
    <MiniAppGate>
      <div className="mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
        <section className="hero-poster-shell mb-6" aria-label="TobySwap">
          <div className="hero-poster-frame">
            <Image
              src="/hero/tobyswap-hero.png"
              alt="TobySwap with Toby, Patience, Taboshi and Sato in the pond"
              width={1536}
              height={1024}
              className="hero-poster-image"
              priority
              sizes="(max-width: 640px) 100vw, 1152px"
            />
            <span className="hero-glint" aria-hidden="true" />
          </div>
          <div className="hero-status-rail" aria-label="TobySwap status">
            <span className="hero-status hero-status-blue"><span className="status-dot" />Base live</span>
            <span className="hero-status hero-status-red">PATIENCE</span>
            <span className="hero-status hero-status-green">TABOSHI</span>
            <span className="hero-status hero-status-cyan">TOBY</span>
            <span className="hero-status hero-status-weth">WETH routes</span>
          </div>
          <div className="hero-cta-deck">
            <a href="#swap" className="hero-cta hero-cta-primary"><span>↔</span><strong>Start a swap</strong><small>Find the best pond route</small></a>
            <a href="/taboshi1" className="hero-cta hero-cta-relic"><span className="hero-cta-seed-art"><Image src="/seed.png" alt="" fill sizes="42px" className="object-cover" /></span><strong>Seeds &amp; Leaves</strong><small>Old relics · new SEED · veiled land</small></a>
            <a href="https://farcaster.xyz/miniapps/6RxWwBQYOf63/tobyworld-atlas" className="hero-cta hero-cta-world"><span>◎</span><strong>Open the Atlas</strong><small>Explore Tobyworld</small></a>
          </div>
        </section>

        <div id="swap" className="scroll-mt-24 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(330px,.92fr)]">
          <div>
            <SwapForm />
            <div className="mt-3"><ShareCallout token="$TOBY" /></div>
            <TokensBurned />
          </div>
          <WorldLinks />
        </div>
      </div>
      <Footer />
      <PondDock active="swap" />
    </MiniAppGate>
  );
}
