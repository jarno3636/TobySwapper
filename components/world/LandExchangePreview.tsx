import Image from "next/image";

export default function LandExchangePreview({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`land-exchange-preview ${compact ? "is-compact" : ""}`}>
      <div className="land-exchange-mark" aria-hidden="true"><span>△</span><Image src="/tokens/toby.PNG" alt="" width={58} height={58} /></div>
      <div className="land-exchange-copy">
        <span>LAND EXCHANGE</span>
        <h2>A market gate is taking shape.</h2>
        <p>Browse the world today. When the land market is ready, this is where listings, prices, and ownership paths can live.</p>
      </div>
      <a href="/world/exchange">Peek inside →</a>
    </section>
  );
}
