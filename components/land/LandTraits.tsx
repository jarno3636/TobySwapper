"use client";

import { useEffect, useMemo, useState } from "react";
import type { LoreMetadata } from "@/lib/lore-metadata";
import { extractLoreTraits } from "@/lib/lore-metadata-shared";

type Props = {
  metadata?: LoreMetadata | null;
  revealed?: boolean;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  tokenId?: bigint | string | null;
  /** Optional override keyed as `${trait_type}::${value}`. Values are collection percentages. */
  rarityByTrait?: Record<string, number | null | undefined>;
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

function normalizeTraitKey(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function traitIconKind(label: string) {
  const key = normalizeTraitKey(label);
  if (key.includes("background")) return "background";
  if (key.includes("core") || key.includes("crystal")) return "core";
  if (key.includes("keeper") || key.includes("frog") || key.includes("toad")) return "keeper";
  if (key === "land" || key.includes("biome") || key.includes("terrain") || key.includes("region")) return "land";
  if (key.includes("relic") || key.includes("artifact") || key.includes("treasure")) return "relic";
  if (key.includes("weather")) return "weather";
  if (key.includes("season")) return "season";
  if (key.includes("element")) return "element";
  if (key.includes("power") || key.includes("ability")) return "power";
  if (key.includes("guardian")) return "guardian";
  if (key.includes("rarity") || key.includes("tier") || key.includes("class")) return "rarity";
  return "sigil";
}

function labelHash(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) hash = ((hash << 5) - hash + label.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function TraitIcon({ label, tone }: { label: string; tone: TraitTone }) {
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

  const kind = traitIconKind(label);

  if (kind === "background") {
    return <svg {...common}><circle cx="16.8" cy="6.8" r="2.7"/><path d="M3.5 17.2 8.2 12l3.15 3.15 2.15-2.25 7 4.3"/><path d="M4 20h16"/><path d="M4.4 7.8c1.8-1.55 3.8-1.8 5.95-.75"/></svg>;
  }
  if (kind === "core") {
    return <svg {...common}><path d="M12 2.9 19 9.6 12 21.1 5 9.6 12 2.9Z"/><path d="m5 9.6 7 2.65 7-2.65M12 2.9v9.35M12 12.25v8.85"/><path d="m8.2 6.6 3.8 5.65 3.8-5.65"/></svg>;
  }
  if (kind === "keeper") {
    return <svg {...common}><path d="M5.7 9.2C5.7 5.7 8.25 3.9 12 3.9s6.3 1.8 6.3 5.3v4.35c0 3.9-2.85 6.55-6.3 6.55s-6.3-2.65-6.3-6.55V9.2Z"/><circle cx="9" cy="9" r="1.05"/><circle cx="15" cy="9" r="1.05"/><path d="M9.1 14.35c.86.72 1.83 1.08 2.9 1.08s2.04-.36 2.9-1.08"/><path d="M3.8 10.8 5.7 12M20.2 10.8 18.3 12"/></svg>;
  }
  if (kind === "land") {
    return <svg {...common}><path d="M4 14.8c1.65-3.8 4.1-5.7 7.35-5.7 3.45 0 6.35 2.15 8.65 6.45"/><path d="M3.2 16.25c2.8 1.65 5.7 2.45 8.7 2.4 3.1-.05 6.05-.9 8.9-2.55"/><path d="M8.3 11.2c.45-2.15 1.75-3.35 3.9-3.6"/><path d="M13.2 8.15c1.15-.15 2.2.15 3.15.9"/></svg>;
  }
  if (kind === "relic") {
    return <svg {...common}><path d="M5.5 8.25h13v10.5h-13z"/><path d="M7.7 8.25V5.3h8.6v2.95M5.5 12h13"/><path d="m10.3 14.45 1.7-1.2 1.7 1.2-.65 2H10.95l-.65-2Z"/><path d="M8.5 20.25h7"/></svg>;
  }
  if (kind === "weather") {
    return <svg {...common}><path d="M6.2 14.2h11.2a3.1 3.1 0 0 0 .15-6.2 5.2 5.2 0 0 0-9.85 1.6A2.35 2.35 0 0 0 6.2 14.2Z"/><path d="m8 17.2-1.1 2M12.2 17.2l-1.1 2M16.4 17.2l-1.1 2"/></svg>;
  }
  if (kind === "season") {
    return <svg {...common}><path d="M18.8 4.2C12.7 4.55 7.1 7.3 5 13.2c3.2 1.05 7.45.35 9.9-2.1 1.75-1.75 2.95-4.2 3.9-6.9Z"/><path d="M5.3 18.9c2.5-4.4 5.65-7.2 9.45-8.5"/><path d="M8.4 14.4c.1 1.55.6 2.85 1.5 3.9"/></svg>;
  }
  if (kind === "element") {
    return <svg {...common}><path d="M12 3.2c2.2 3.05 4.9 5.45 4.9 9.15A4.9 4.9 0 0 1 12 17.3a4.9 4.9 0 0 1-4.9-4.95C7.1 8.65 9.8 6.25 12 3.2Z"/><path d="M12 17.3v3.5M8.8 19.1h6.4"/></svg>;
  }
  if (kind === "power") {
    return <svg {...common}><path d="m13.4 2.9-7 10.1h5l-.8 8.1 7-10.3h-5.05l.85-7.9Z"/><path d="M4.2 6.2h2.4M17.5 17.8h2.3"/></svg>;
  }
  if (kind === "guardian") {
    return <svg {...common}><path d="M12 3.2 19 6v5.1c0 4.6-2.6 7.65-7 9.7-4.4-2.05-7-5.1-7-9.7V6l7-2.8Z"/><path d="m8.8 11.7 2.05 2.05 4.45-4.5"/></svg>;
  }
  if (kind === "rarity") {
    return <svg {...common}><path d="m12 3 2.45 5.05L20 8.85l-4 3.9.95 5.5L12 15.65l-4.95 2.6.95-5.5-4-3.9 5.55-.8L12 3Z"/><circle cx="12" cy="11" r="1.55"/></svg>;
  }

  // Unknown future traits still receive a deterministic one-of-a-kind sigil,
  // rather than falling back to the same generic icon for every new trait.
  const hash = labelHash(label);
  const dotA = 5 + (hash % 5);
  const dotB = 14 + ((hash >> 3) % 5);
  const notch = 7 + ((hash >> 6) % 4);
  return <svg {...common}><path d={`M12 3.4 19 7.2v9.6L12 20.6 5 16.8V7.2L12 3.4Z`}/><path d={`M${notch} 8.1 12 11.6 17 8.1M12 11.6v5.2`}/><circle cx={dotA} cy="15.2" r=".8"/><circle cx={dotB} cy="15.2" r=".8"/></svg>;
}

export default function LandTraits({ tokenId, metadata, revealed = false, loading = false, error = null, onRefresh, rarityByTrait = {} }: Props) {
  const [liveRarity, setLiveRarity] = useState<Record<string, number | null>>({});
  const [rarityReady, setRarityReady] = useState(false);

  useEffect(() => {
    if (!revealed || tokenId == null) {
      setLiveRarity({});
      setRarityReady(false);
      return;
    }

    let cancelled = false;
    setRarityReady(false);

    fetch(`/api/lore/rarity?tokenId=${encodeURIComponent(String(tokenId))}`, { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("rarity unavailable");
        return response.json();
      })
      .then((payload) => {
        if (cancelled || !Array.isArray(payload?.traits)) return;
        const next: Record<string, number | null> = {};
        for (const trait of payload.traits) {
          const label = String(trait?.traitType ?? "").trim();
          const value = textValue(trait?.value).trim();
          if (!label || !value) continue;
          next[`${label}::${value}`] = typeof trait?.percentage === "number" ? trait.percentage : null;
        }
        setLiveRarity(next);
        setRarityReady(true);
      })
      .catch(() => {
        if (!cancelled) setRarityReady(false);
      });

    return () => { cancelled = true; };
  }, [revealed, tokenId]);

  const rarity = useMemo(() => ({ ...liveRarity, ...rarityByTrait }), [liveRarity, rarityByTrait]);

  const traits = extractLoreTraits(metadata)
    .map((trait, index) => ({
      label: (trait.trait_type || `Trait ${index + 1}`).trim(),
      value: textValue(trait.value).trim(),
      tone: traitTone(trait.trait_type || ""),
      rarity: rarity[`${(trait.trait_type || `Trait ${index + 1}`).trim()}::${textValue(trait.value).trim()}`],
      index,
    }))
    .filter((trait) => trait.value.length > 0);

  if (!revealed && !traits.length) return null;

  return (
    <section className={`land-traits land-reveal-traits ${traits.length ? "has-traits" : "is-waiting"}`} aria-labelledby="land-traits-title">
      <div className="land-traits-head">
        <div>
          <span className="land-section-kicker">LAND SIGNATURE · {revealed ? "REVEALED" : "METADATA"}</span>
          <h2 id="land-traits-title">What makes this place unique</h2>
          <p>{traits.length ? "Traits read directly from the revealed canonical metadata." : "The deed is revealed. TobySwap is reading its canonical trait signature."}</p>
        </div>
        <span className="land-traits-count"><i aria-hidden="true" />{traits.length ? `${traits.length} ${traits.length === 1 ? "trait" : "traits"}` : loading ? "reading" : "waiting"}</span>
      </div>

      {traits.length ? (
        <div className="land-traits-grid">
          {traits.map((trait) => (
            <article className="land-trait-card" data-tone={trait.tone} key={`${trait.label}-${trait.index}`}>
              <div className="land-trait-icon" aria-hidden="true"><TraitIcon label={trait.label} tone={trait.tone} /></div>
              <div className="land-trait-copy">
                <span>{trait.label}</span>
                <strong title={trait.value}>{trait.value}</strong>
                <div className="land-trait-meta">
                  <span className={`land-trait-rarity ${typeof trait.rarity === "number" ? "is-known" : "is-pending"}`} title={typeof trait.rarity === "number" ? `${trait.rarity.toFixed(2)}% of all 2,869 canonical Lore Deeds share this exact trait value.` : "Collection rarity is being calculated."}>
                    <b>{typeof trait.rarity === "number" ? "COLLECTION" : "RARITY"}</b>
                    <em>{typeof trait.rarity === "number" ? `${trait.rarity.toFixed(trait.rarity < 1 ? 2 : 1)}%` : rarityReady ? "—" : "…"}</em>
                  </span>
                </div>
              </div>
              <div className="land-trait-watermark" aria-hidden="true"><TraitIcon label={trait.label} tone={trait.tone} /></div>
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
