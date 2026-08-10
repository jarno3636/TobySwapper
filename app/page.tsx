"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import MiniAppGate from "@/components/MiniAppGate";
import SwapForm from "@/components/SwapForm";
import Footer from "@/components/Footer";
import ShareCallout from "@/components/ShareCallout";
import WorldLinks from "@/components/WorldLinks";

const TokensBurned = dynamic(() => import("@/components/TokensBurned"), { ssr: false });

const pondMarks = [
  { src: "/tokens/toby.PNG", alt: "Toby", label: "TOBY", tone: "blue" },
  { src: "/tokens/patience.PNG", alt: "Patience", label: "PATIENCE", tone: "red" },
  { src: "/tokens/taboshi.PNG", alt: "Taboshi", label: "TABOSHI", tone: "green" },
  { src: "/tokens/sato.PNG", alt: "Sato", label: "SATO", tone: "cyan" },
] as const;

export default function Page() {
  return (
    <MiniAppGate>
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-5 sm:px-6 sm:pt-7">
        <section className="world-hero pond-hero mb-6 overflow-hidden p-5 sm:p-7 lg:p-8">
          <div className="pond-hero-grid">
            <div className="relative z-10">
              <div className="world-kicker">TOBYWORLD · BASE MAINNET</div>
              <h1 className="mt-2 max-w-2xl text-3xl font-black leading-[1.02] tracking-[-.045em] sm:text-5xl lg:text-[56px]">
                Swap across the pond.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-inkSub sm:text-base">
                A simple Tobyworld gateway for ETH, USDC, TOBY, PATIENCE and TABOSHI. Find a Base route, preview the trade, then swap through the TobySwapper contract.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="status-capsule"><span className="status-dot" /> Base live</span>
                <span className="world-chip">Non-custodial</span>
                <span className="world-chip">TOBY burn</span>
              </div>
            </div>

            <div className="pond-art-stage" aria-label="Tobyworld assets">
              <div className="pond-orbit" aria-hidden="true" />
              <div className="pond-character">
                <Image src="/tokens/toby.PNG" alt="Toby" fill sizes="190px" className="object-contain" priority />
              </div>
              <div className="pond-sato">
                <Image src="/tokens/sato.PNG" alt="Sato" fill sizes="74px" className="object-contain rounded-full" />
              </div>
              <span className="sparkle sparkle-a">✦</span>
              <span className="sparkle sparkle-b">·</span>
            </div>
          </div>

          <div className="pond-mark-strip mt-6">
            {pondMarks.map((mark) => (
              <div className="pond-mark" key={mark.label}>
                <span className={`pond-mark-icon pond-mark-${mark.tone}`}>
                  <Image src={mark.src} alt={mark.alt} fill sizes="42px" className="object-contain p-1" />
                </span>
                <span>{mark.label}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(330px,.92fr)]">
          <div>
            <SwapForm />
            <div className="mt-3"><ShareCallout token="$TOBY" /></div>
            <TokensBurned />
          </div>
          <WorldLinks />
        </div>
      </div>
      <Footer />
    </MiniAppGate>
  );
}
