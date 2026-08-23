import Link from "next/link";
import TobyworldIcon from "@/components/TobyworldIcon";

export default function LandExchangePreview({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`land-exchange-preview ${compact ? "is-compact" : ""}`}>
      <div className="land-exchange-mark" aria-hidden="true"><TobyworldIcon kind="lore" size={58} /><TobyworldIcon kind="taboshi" size={34} className="market-companion-icon" /></div>
      <div className="land-exchange-copy">
        <span>TOBYWORLD MARKET</span>
        <h2>SEED and land, one market.</h2>
        <p>A simple Base marketplace for SEED, Old Lore Land, and Canonical Lore Land—with USDC, ETH, or TOBY payments.</p>
      </div>
      <Link prefetch={false} href="/world/exchange">Open market →</Link>
    </section>
  );
}
