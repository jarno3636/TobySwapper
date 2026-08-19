"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readWorldLandDirectory, type WorldLandSummary } from "@/lib/land-directory";


export default function WorldAtlas() {
  const [lands, setLands] = useState<WorldLandSummary[]>([]);
  const [query, setQuery] = useState("");
  const [deedId, setDeedId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    readWorldLandDirectory().then((rows) => { if (!cancelled) setLands(rows); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lands;
    return lands.filter((land) => land.tokenId.includes(q) || land.communityName?.toLowerCase().includes(q) || land.description?.toLowerCase().includes(q));
  }, [lands, query]);

  return (
    <>
      <section className="world-search-panel">
        <div className="world-search-copy"><span>EXPLORE THE LAND</span><h2>Find a place in Tobyworld</h2><p>Search community lands by name or deed number.</p></div>
        <div className="world-search-controls">
          <label className="world-search-field"><span>SEARCH WORLD</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mossy Hollow or #742" /></label>
          <div className="world-deed-jump"><label><span>DEED #</span><input inputMode="numeric" value={deedId} onChange={(e) => setDeedId(e.target.value.replace(/\D/g, ""))} placeholder="742" /></label><Link prefetch={false} href={deedId ? `/land/${deedId}` : "#atlas"} className={!deedId ? "is-disabled" : ""} aria-disabled={!deedId}>Visit →</Link></div>
        </div>
      </section>

      <section className="world-atlas-section">
        <div className="world-atlas-head"><div><span>COMMUNITY LANDS</span><h2>{loading ? "Opening the atlas…" : `${filtered.length} place${filtered.length === 1 ? "" : "s"} to explore`}</h2></div><div className="world-atlas-head-actions"><Link prefetch={false} href="/taboshi1#land">My Land</Link><Link prefetch={false} href="/world/exchange" className="is-exchange">Market</Link></div></div>
        {!loading && filtered.length === 0 ? (
          <div className="world-empty"><span>△</span><h3>{lands.length === 0 ? "The atlas is waiting for its first names." : "No land matched that trail."}</h3><p>{lands.length === 0 ? "Landowners can name their place from their public land page." : "Try a deed number or land name."}</p></div>
        ) : (
          <div className="world-land-grid">
            {filtered.map((land) => (
              <Link prefetch={false} key={land.tokenId} href={`/land/${land.tokenId}`} className={`world-land-card theme-${land.bannerTheme}`}>
                <div className="world-land-scene" aria-hidden="true"><span className="world-land-sky" /><span className="world-land-moon" /><span className="world-land-hill h1" /><span className="world-land-hill h2" /><span className="world-land-water" /><span className="world-land-rune">△</span></div>
                <div className="world-land-copy"><span className="world-land-id">LORE LAND #{land.tokenId}</span><h3>{land.communityName || `Land #${land.tokenId}`}</h3><p>{land.description || "A place in Tobyworld waiting to tell more of its story."}</p><div><small>LORE DEED #{land.tokenId}</small><b>Visit Land →</b></div></div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
