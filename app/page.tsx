"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import MiniAppGate from "@/components/MiniAppGate";
import SwapForm from "@/components/SwapForm";
import Footer from "@/components/Footer";
import ShareCallout from "@/components/ShareCallout";
import WorldLinks from "@/components/WorldLinks";
import PondDock from "@/components/PondDock";
import TobyworldAssets from "@/components/TobyworldAssets";

const TokensBurned = dynamic(() => import("@/components/TokensBurned"), { ssr: false });
function HeroArtwork() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const readTheme = () =>
      setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

    readTheme();
    window.addEventListener("tobyswap:theme-change", readTheme);
    return () => window.removeEventListener("tobyswap:theme-change", readTheme);
  }, []);

  return (
    <Image
      src={theme === "dark" ? "/hero/tobyswap-hero-dark.png" : "/hero/tobyswap-hero.png"}
      alt="TobySwap with Toby, Patience, Taboshi and Sato in the pond"
      width={1536}
      height={1024}
      className="hero-poster-image"
      priority
      sizes="(max-width: 640px) 100vw, 1152px"
    />
  );
}

function SwapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h12m0 0-3-3m3 3-3 3M19 17H7m0 0 3 3m-3-3 3-3" />
    </svg>
  );
}

function AtlasIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 12h10m-4-4 4 4-4 4" />
    </svg>
  );
}


export default function Page() {
  return (
    <MiniAppGate>
      <div className="mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
        <section className="hero-poster-shell mb-6" aria-label="TobySwap">
          <div className="hero-poster-frame">
            <HeroArtwork />
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
            <a href="#swap" className="hero-cta hero-cta-primary">
              <span className="hero-cta-icon"><SwapIcon /></span>
              <span className="hero-cta-copy"><strong>Start a swap</strong><small>Find the best pond route</small></span>
              <span className="hero-cta-arrow"><ArrowIcon /></span>
            </a>
            <Link prefetch={false} href="/taboshi1" className="hero-cta hero-cta-relic">
              <span className="hero-cta-seed-art"><Image src="/seed.png" alt="" fill sizes="46px" className="object-cover" /></span>
              <span className="hero-cta-copy"><strong>My Tobyworld</strong><small>Your pouch · land · seeds · discoveries</small></span>
              <span className="hero-cta-arrow"><ArrowIcon /></span>
            </Link>
            <a href="https://farcaster.xyz/miniapps/6RxWwBQYOf63/tobyworld-atlas" className="hero-cta hero-cta-world">
              <span className="hero-cta-icon"><AtlasIcon /></span>
              <span className="hero-cta-copy"><strong>Open the Atlas</strong><small>Explore Tobyworld</small></span>
              <span className="hero-cta-arrow"><ArrowIcon /></span>
            </a>
          </div>
        </section>

        <TobyworldAssets />

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
