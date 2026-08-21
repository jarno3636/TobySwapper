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

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function traitGlyph(label: string, index: number) {
  const key = label.toLowerCase();
  if (key.includes("background") || key.includes("sky") || key.includes("weather")) return "◌";
  if (key.includes("core") || key.includes("crystal") || key.includes("element")) return "◇";
  if (key.includes("keeper") || key.includes("frog") || key.includes("toad")) return "●";
  if (key.includes("land") || key.includes("biome") || key.includes("terrain")) return "⌁";
  if (key.includes("relic") || key.includes("artifact")) return "✦";
  if (key.includes("rarity") || key.includes("class")) return "◆";
  return ["△", "○", "✦", "◇", "⌁"][index % 5];
}

export default function LandTraits({ metadata, revealed = false, loading = false, error = null, onRefresh }: Props) {
  const traits = extractLoreTraits(metadata)
    .map((trait, index) => ({
      label: (trait.trait_type || `Trait ${index + 1}`).trim(),
      value: textValue(trait.value).trim(),
      index,
    }))
    .filter((trait) => trait.value.length > 0);

  if (!revealed && !traits.length) return null;

  return (
    <section className={`land-traits land-reveal-traits ${traits.length ? "has-traits" : "is-waiting"}`} aria-labelledby="land-traits-title">
      <div className="land-traits-head">
        <div>
          <span className="land-section-kicker">LAND SIGNATURE · {revealed ? "REVEALED" : "METADATA"}</span>
          <h2 id="land-traits-title">What makes this land yours</h2>
          <p>{traits.length ? "Traits read directly from the canonical deed metadata." : "The deed is revealed. TobySwap is reading its canonical trait signature."}</p>
        </div>
        <span className="land-traits-count"><i aria-hidden="true" />{traits.length ? `${traits.length} ${traits.length === 1 ? "trait" : "traits"}` : loading ? "reading" : "waiting"}</span>
      </div>

      {traits.length ? (
        <div className="land-traits-grid">
          {traits.map((trait) => (
            <article className="land-trait-card" key={`${trait.label}-${trait.index}`}>
              <div className="land-trait-glyph" aria-hidden="true">{traitGlyph(trait.label, trait.index)}</div>
              <div className="land-trait-copy">
                <span>{trait.label}</span>
                <strong title={trait.value}>{trait.value}</strong>
              </div>
              <small>#{String(trait.index + 1).padStart(2, "0")}</small>
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
