"use client";

import type { LoreMetadata } from "@/lib/lore-metadata";

type Props = { metadata?: LoreMetadata | null };

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
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
    <section className="land-traits" aria-labelledby="land-traits-title">
      <div className="land-traits-head">
        <div>
          <span className="land-section-kicker">REVEALED METADATA</span>
          <h2 id="land-traits-title">Land traits</h2>
        </div>
        <span className="land-traits-count">{traits.length} {traits.length === 1 ? "trait" : "traits"}</span>
      </div>
      <div className="land-traits-grid">
        {traits.map((trait) => (
          <div className="land-trait-card" key={`${trait.label}-${trait.index}`}>
            <span>{trait.label}</span>
            <strong title={trait.value}>{trait.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
