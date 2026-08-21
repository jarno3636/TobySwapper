"use client";

import Image from "next/image";
import { formatUnits } from "viem";

function compact(value: bigint, decimals = 18) {
  const n = Number(formatUnits(value, decimals));
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumSignificantDigits: 5 });
}

export default function LandRelics({
  toby,
  patience,
  taboshi,
  oldLeaf,
  seed,
}: {
  toby: bigint;
  patience: bigint;
  taboshi: bigint;
  oldLeaf: bigint;
  seed: bigint;
}) {
  const items = [
    { label: "TOBY", note: "pond affiliation", value: compact(toby), icon: "/tokens/toby.PNG" },
    { label: "PATIENCE", note: "ancient flame", value: compact(patience), icon: "/ui/patience.webp" },
    { label: "TABOSHI", note: "awakened leaf", value: compact(taboshi), icon: "/ui/taboshi.webp" },
    { label: "OLD LEAF", note: "historical relic", value: oldLeaf.toLocaleString(), icon: "/ui/taboshi.webp" },
    { label: "SEED", note: "new beginning", value: seed.toLocaleString(), icon: "/ui/seed.webp" },
  ];

  return (
    <section className="land-module land-relics-module">
      <div className="land-module-head"><div><span className="land-section-kicker">KEEPER&apos;S POUCH</span><h2>Relics & signals</h2></div><span className="land-live-chip">CARRIED HERE</span></div>
      <div className="land-relic-grid">
        {items.map((item) => (
          <article key={item.label} className="land-relic-tile">
            <span className="land-relic-icon"><Image src={item.icon} alt="" fill sizes="48px" className="object-contain" /></span>
            <div><small>{item.note}</small><strong>{item.label}</strong><b>{item.value}</b></div>
          </article>
        ))}
      </div>
    </section>
  );
}
