"use client";

import type { LoreMetadata } from "@/lib/lore-metadata";

type Props = { metadata?: LoreMetadata | null };

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

export default function LandTraits({ metadata }: Props) {
  const traits = (metadata?.attributes || [])
    .map((trait, index) => ({
      label: (trait?.trait_type || `Trait ${index + 1}`).trim(),
      value: textValue(trait?.value).trim(),
      index,
    }))
    .filter((trait) => trait.value.length > 0);

  if (!traits.length) return null;

  return (
    <section className="land-traits land-reveal-traits" aria-labelledby="land-traits-title">
      <div className="land-traits-head">
        <div>
          <span className="land-section-kicker">LAND SIGNATURE · REVEALED</span>
          <h2 id="land-traits-title">What makes this land yours</h2>
          <p>These traits come directly from the canonical deed metadata.</p>
        </div>
        <span className="land-traits-count"><i aria-hidden="true" />{traits.length} {traits.length === 1 ? "trait" : "traits"}</span>
      </div>

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
    </section>
  );
}
