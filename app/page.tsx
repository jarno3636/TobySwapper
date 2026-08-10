"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import MiniAppGate from "@/components/MiniAppGate";
import SwapForm from "@/components/SwapForm";
import Footer from "@/components/Footer";
import ShareCallout from "@/components/ShareCallout";
import WorldLinks from "@/components/WorldLinks";

const TokensBurned = dynamic(() => import("@/components/TokensBurned"), { ssr: false });

export default function Page() {
  return (
    <MiniAppGate>
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-5 sm:pt-8">
        <section className="world-hero mb-6 overflow-hidden p-5 sm:p-7">
          <div className="grid items-center gap-5 md:grid-cols-[1fr_auto]">
            <div>
              <div className="world-kicker">TOBYWORLD · BASE</div>
              <h1 className="mt-2 max-w-2xl text-3xl font-black leading-[1.05] tracking-[-.035em] sm:text-5xl">
                Swap the pond.<br />Burn a little TOBY.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-inkSub sm:text-base">
                Trade ETH, USDC, TOBY, PATIENCE and TABOSHI through the verified TobySwapper contract. The app searches Base routes and applies the contract&apos;s TOBY burn fee.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="world-chip">TOBY</span>
                <span className="world-chip world-chip-red">PATIENCE</span>
                <span className="world-chip world-chip-green">TABOSHI</span>
                <span className="world-chip">BASE</span>
              </div>
            </div>
            <div className="relative mx-auto h-36 w-36 sm:h-44 sm:w-44">
              <div className="absolute inset-3 rounded-full bg-[#dff5ff]" />
              <Image src="/toby2.PNG" alt="Toby" fill sizes="176px" className="relative object-contain drop-shadow-[0_10px_0_rgba(25,29,42,.08)]" priority />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,.92fr)]">
          <div>
            <SwapForm />
            <div className="mt-3 flex items-center gap-2"><ShareCallout token="$TOBY" /></div>
            <TokensBurned />
          </div>
          <WorldLinks />
        </div>
      </div>
      <Footer />
    </MiniAppGate>
  );
}
