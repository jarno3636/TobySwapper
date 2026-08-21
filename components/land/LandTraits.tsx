"use client";

import type { LoreMetadata } from "@/lib/lore-metadata";
import { extractLoreTraits } from "@/lib/lore-metadata-shared";

type Props = {
  metadata?: LoreMetadata | null;
  revealed?: boolean;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
};

type TraitTone = "sky" | "core" | "keeper" | "land" | "relic" | "rarity" | "default";

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function traitTone(label: string): TraitTone {
  const key = label.toLowerCase();
  if (key.includes("background") || key.includes("sky") || key.includes("weather") || key.includes("season")) return "sky";
  if (key.includes("core") || key.includes("crystal") || key.includes("element") || key.includes("power")) return "core";
  if (key.includes("keeper") || key.includes("frog") || key.includes("toad") || key.includes("guardian")) return "keeper";
  if (key.includes("land") || key.includes("biome") || key.includes("terrain") || key.includes("region")) return "land";
  if (key.includes("relic") || key.includes("artifact") || key.includes("item") || key.includes("treasure")) return "relic";
  if (key.includes("rarity") || key.includes("class") || key.includes("tier")) return "rarity";
  return "default";
}

function TraitIcon({ tone }: { tone: TraitTone }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.65,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (tone === "sky") {
    return <svg {...common}><path d="M4 15.5h16"/><path d="M6.5 15.5a5.5 5.5 0 0 1 11 0"/><path d="M12 4v2.1M5.9 6.6l1.5 1.5M18.1 6.6l-1.5 1.5"/><path d="M7 19h10"/></svg>;
  }
  if (tone === "core") {
    return <svg {...common}><path d="M12 3.25 18.75 10 12 20.75 5.25 10 12 3.25Z"/><path d="m5.25 10 6.75 2.4L18.75 10M12 3.25v9.15M12 12.4v8.35"/></svg>;
  }
  if (tone === "keeper") {
    return <svg {...common}><path d="M6.25 9.25C6.25 5.8 8.55 4 12 4s5.75 1.8 5.75 5.25v4.25c0 3.9-2.65 6.5-5.75 6.5s-5.75-2.6-5.75-6.5V9.25Z"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/><path d="M9.2 14.3c.8.65 1.73.95 2.8.95s2-.3 2.8-.95"/><path d="M4.5 11.2 6.25 12M19.5 11.2 17.75 12"/></svg>;
  }
  if (tone === "land") {
    return <svg {...common}><path d="m3.5 16.5 5.2-6 3.1 3.5 2.1-2.4 6.6 4.9"/><path d="M4 19h16"/><path d="M7 7.2c1.25-1.4 2.6-2.1 4.05-2.1 1.1 0 2.05.4 2.85 1.2"/></svg>;
  }
  if (tone === "relic") {
    return <svg {...common}><path d="M6 8.25h12v10.5H6z"/><path d="M8 8.25V5.5h8v2.75M6 12h12"/><path d="M12 10.75v2.5"/><path d="M9.3 16h5.4"/></svg>;
  }
  if (tone === "rarity") {
    return <svg {...common}><path d="m12 3 2.45 5.05L20 8.85l-4 3.9.95 5.5L12 15.65l-4.95 2.6.95-5.5-4-3.9 5.55-.8L12 3Z"/><path d="M12 7.2v4.9"/></svg>;
  }
  return <svg {...common}><path d="m12 3.5 7 4v8l-7 4-7-4v-8l7-4Z"/><circle cx="12" cy="11.5" r="2.25"/><path d="M12 13.75v2.25"/></svg>;
}

export default function LandTraits({ metadata, revealed = false, loading = false, error = null, onRefresh }: Props) {
  const traits = extractLoreTraits(metadata)
    .map((trait, index) => ({
      label: (trait.trait_type || `Trait ${index + 1}`).trim(),
      value: textValue(trait.value).trim(),
      tone: traitTone(trait.trait_type || ""),
      index,
    }))
    .filter((trait) => trait.value.length > 0);

  if (!revealed && !traits.length) return null;

  return (
    <section className={`land-traits land-reveal-traits ${traits.length ? "has-traits" : "is-waiting"}`} aria-labelledby="land-traits-title">
      <div className="land-traits-head">
        <div>
          <span className="land-section-kicker">LAND SIGNATURE · {revealed ? "REVEALED" : "METADATA"}</span>
          <h2 id="land-traits-title">Your land, in traits</h2>
          <p>{traits.length ? "The canonical attributes that define this deed." : "The deed is revealed. TobySwap is reading its canonical trait signature."}</p>
        </div>
        <span className="land-traits-count"><i aria-hidden="true" />{traits.length ? `${traits.length} ${traits.length === 1 ? "trait" : "traits"}` : loading ? "reading" : "waiting"}</span>
      </div>

      {traits.length ? (
        <div className="land-traits-grid">
          {traits.map((trait) => (
            <article className="land-trait-card" data-tone={trait.tone} key={`${trait.label}-${trait.index}`}>
              <div className="land-trait-icon" aria-hidden="true"><TraitIcon tone={trait.tone} /></div>
              <div className="land-trait-copy">
                <span>{trait.label}</span>
                <strong title={trait.value}>{trait.value}</strong>
              </div>
              <span className="land-trait-canonical" title="Read from canonical metadata" aria-label="Canonical metadata trait">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.2 8.2 2.25 2.25L11.9 5"/></svg>
              </span>
            </article>
          ))}
        </div>
      ) : (
        <div className="land-traits-waiting" role="status" aria-live="polite">
          <div className="land-traits-orbit" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <strong>{loading ? "Reading canonical traits…" : "Trait metadata has not reached this gateway yet"}</strong>
            <p>{error || "The reveal is live. This panel will populate automatically as soon as the canonical metadata response exposes its traits."}</p>
          </div>
          {onRefresh ? <button type="button" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh traits"}</button> : null}
        </div>
      )}
    </section>
  );
}
