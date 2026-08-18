"use client";

export default function LandProductionPlaceholder({ revealed }: { revealed: boolean }) {
  return (
    <section className="land-module land-production-module">
      <div className="land-production-rune" aria-hidden="true">△</div>
      <div>
        <span className="land-section-kicker">PRODUCTION</span>
        <h2>{revealed ? "The land is revealed. Its economy is not assumed." : "Awaiting the pond"}</h2>
        <p>When canonical contracts expose production, claim, harvest, epoch, rate, reward, or related mechanics, this module can plug into those real rules. Until then, nothing is invented.</p>
      </div>
      <span className="land-production-status">CANONICAL ONLY</span>
    </section>
  );
}
