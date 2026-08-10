"use client";

import Image from "next/image";
import MiniAppGate from "@/components/MiniAppGate";
import BurnerLeaderboard from "@/components/BurnerLeaderboard";
import Footer from "@/components/Footer";
import PondDock from "@/components/PondDock";

export default function BurnersPage() {
  return (
    <MiniAppGate>
      <div className="mx-auto w-full max-w-5xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
        <section className="burn-hero" aria-label="Pond Burners leaderboard">
          <div className="burn-hero-copy">
            <span className="burn-hero-kicker">THE POND KEEPS SCORE</span>
            <h2>Top <em>Burners</em></h2>
            <p>Swap through TobySwap. Feed the flame. Climb the all-time onchain burn trail.</p>
            <div className="burn-hero-actions">
              <a href="/#swap" className="metal-button burn-hero-cta burn-hero-cta-primary"><span>↔</span> Swap &amp; climb</a>
              <a href="#leaderboard" className="metal-button burn-hero-cta"><span>↓</span> See the ranks</a>
            </div>
          </div>
          <div className="burn-hero-art" aria-hidden="true">
            <span className="burn-hero-toby"><Image src="/tokens/toby.PNG" alt="" fill sizes="140px" className="object-contain" /></span>
            <span className="burn-hero-triangle"><Image src="/tokens/patience.PNG" alt="" fill sizes="80px" className="object-contain" /></span>
            <span className="burn-hero-sato"><Image src="/tokens/sato.PNG" alt="" fill sizes="72px" className="object-contain" /></span>
            <i className="burn-spark burn-spark-one">✦</i><i className="burn-spark burn-spark-two">✦</i><i className="burn-spark burn-spark-three">✦</i>
          </div>
        </section>
        <div id="leaderboard" className="scroll-mt-24"><BurnerLeaderboard /></div>
      </div>
      <Footer />
      <PondDock active="burners" />
    </MiniAppGate>
  );
}
