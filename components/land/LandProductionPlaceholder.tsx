"use client";

export default function LandProductionPlaceholder({ revealed }: { revealed: boolean }) {
  return (
    <section className="land-module land-production-module">
      <div className="land-production-rune" aria-hidden="true">△</div>
      <div>
        <span className="land-section-kicker">BEYOND THE VEIL</span>
        <h2>{revealed ? "Something still sleeps beneath the land" : "The land keeps a secret"}</h2>
        <p>The next part of this place has not been revealed. For now, the garden grows only in how it is seen.</p>
      </div>
      <span className="land-production-status">NOT YET REVEALED</span>
    </section>
  );
}
