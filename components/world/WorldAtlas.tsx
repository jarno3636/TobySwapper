"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isAddress } from "viem";
import TobyworldIcon from "@/components/TobyworldIcon";

type AtlasTrait = { traitType: string; value: string };
type AtlasLand = {
  tokenId: string;
  canonicalName: string | null;
  imageUrl: string | null;
  traits: AtlasTrait[];
  communityName: string | null;
  keeperStory: string | null;
  keeperName: string | null;
  keeperSocial: string | null;
  bannerTheme: string;
};
type DiscoveryValue = { value: string; count: number; percentage: number };
type DiscoveryGroup = { traitType: string; count: number; values: DiscoveryValue[] };
type WalletDeed = { tokenId: string; communityName?: string | null };

const PER_PAGE = 36;

function traitValue(land: AtlasLand, label: string) {
  return land.traits.find((trait) => trait.traitType.toLowerCase() === label.toLowerCase())?.value || null;
}

function compactSigns(land: AtlasLand) {
  const priority = ["Land", "Core", "Keeper", "Relic", "Background"];
  const chosen: AtlasTrait[] = [];
  for (const label of priority) {
    const match = land.traits.find((trait) => trait.traitType.toLowerCase() === label.toLowerCase());
    if (match) chosen.push(match);
  }
  for (const trait of land.traits) {
    if (chosen.length >= 4) break;
    if (!chosen.some((item) => item.traitType === trait.traitType && item.value === trait.value)) chosen.push(trait);
  }
  return chosen.slice(0, 4);
}

function randomLoreId() {
  const roll = Math.floor(Math.random() * 2869);
  if (roll < 1369) return roll + 1;
  if (roll < 2369) return 2501 + (roll - 1369);
  return 3501 + (roll - 2369);
}

export default function WorldAtlas() {
  const router = useRouter();
  const [lands, setLands] = useState<AtlasLand[]>([]);
  const [groups, setGroups] = useState<DiscoveryGroup[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [jumpValue, setJumpValue] = useState("");
  const [traitType, setTraitType] = useState("");
  const [traitValueFilter, setTraitValueFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(2869);
  const [loading, setLoading] = useState(true);
  const [jumpLoading, setJumpLoading] = useState(false);
  const [jumpMessage, setJumpMessage] = useState("");
  const [walletDeeds, setWalletDeeds] = useState<WalletDeed[]>([]);


  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("wander") === "1") {
      router.replace(`/land/${randomLoreId()}`);
      return;
    }
    setQuery(params.get("q") || "");
    setTraitType(params.get("trait") || "");
    setTraitValueFilter(params.get("value") || "");
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/lore/discovery", { cache: "force-cache" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload) => { if (!cancelled && Array.isArray(payload?.groups)) setGroups(payload.groups); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const loadAtlas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) });
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (traitType && traitValueFilter) {
        params.set("traitType", traitType);
        params.set("traitValue", traitValueFilter);
      }
      const response = await fetch(`/api/lore/atlas?${params.toString()}`, { cache: "force-cache" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error("Atlas unavailable");
      setLands(Array.isArray(payload?.lands) ? payload.lands : []);
      setTotal(Number(payload?.total || 0));
      setPageCount(Math.max(1, Number(payload?.pageCount || 1)));
    } catch {
      setLands([]);
      setTotal(0);
      setPageCount(1);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQuery, traitType, traitValueFilter]);

  useEffect(() => { void loadAtlas(); }, [loadAtlas]);
  useEffect(() => { setPage(1); }, [debouncedQuery, traitType, traitValueFilter]);

  const cleanJump = jumpValue.trim();
  const numericJump = /^#?\d+$/.test(cleanJump) ? cleanJump.replace(/^#/, "") : "";
  const walletJump = isAddress(cleanJump);
  const canJump = Boolean(numericJump || walletJump);
  const activeDiscovery = useMemo(
    () => groups.find((group) => group.traitType === traitType)?.values.find((value) => value.value === traitValueFilter) || null,
    [groups, traitType, traitValueFilter],
  );

  async function openJump() {
    if (!canJump || jumpLoading) return;
    setJumpMessage("");
    setWalletDeeds([]);

    if (numericJump) {
      router.push(`/land/${numericJump}`);
      return;
    }

    setJumpLoading(true);
    try {
      const response = await fetch(`/api/land/owned?owner=${encodeURIComponent(cleanJump)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      const deeds = Array.isArray(payload?.deeds) ? payload.deeds as WalletDeed[] : [];
      if (!response.ok) throw new Error("That wallet could not be searched.");
      if (deeds.length === 0) return setJumpMessage("No canonical Lore Deeds were found in that wallet.");
      if (deeds.length === 1) return router.push(`/land/${deeds[0].tokenId}`);
      setWalletDeeds(deeds);
      setJumpMessage(`${deeds.length} Lore Deeds found — choose a land.`);
    } catch (error: any) {
      setJumpMessage(error?.message || "The wallet trail could not be followed.");
    } finally {
      setJumpLoading(false);
    }
  }

  function chooseTrait(nextType: string, nextValue: string) {
    if (traitType === nextType && traitValueFilter === nextValue) {
      setTraitType("");
      setTraitValueFilter("");
      return;
    }
    setTraitType(nextType);
    setTraitValueFilter(nextValue);
    document.getElementById("atlas-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <section className="world-entry-panel">
        <div className="world-entry-copy">
          <span className="land-section-kicker">ENTER TOBYWORLD</span>
          <h2>2,869 lands. One world to wander.</h2>
          <p>Every canonical Lore Land is now in the Atlas. Visit a deed, find the lands held by a wallet, or let the pond choose your next destination.</p>
        </div>
        <div className="world-entry-actions">
          <button type="button" className="world-wander-button" onClick={() => router.push(`/land/${randomLoreId()}`)}><TobyworldIcon kind="sato" size={42} /><b>Wander</b><small>Visit a random canonical land</small><i>→</i></button>
          <div className={`world-deed-jump ${walletJump ? "is-wallet" : numericJump ? "is-deed" : ""}`}>
            <div className="world-jump-mark" aria-hidden="true">{walletJump ? <TobyworldIcon kind="pouch" size={40} /> : <TobyworldIcon kind="lore" size={44} />}</div>
            <label><span>OPEN A LORE LAND</span><input value={jumpValue} onChange={(event) => { setJumpValue(event.target.value); setJumpMessage(""); setWalletDeeds([]); }} onKeyDown={(event) => { if (event.key === "Enter") void openJump(); }} autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="Deed #30 or 0x wallet" /><small>{walletJump ? "Base wallet detected" : numericJump ? `Ready for Lore Land #${numericJump}` : "Deed number or Base wallet"}</small></label>
            <button type="button" onClick={() => void openJump()} disabled={!canJump || jumpLoading}>{jumpLoading ? "Following…" : walletJump ? "Find lands →" : "Visit →"}</button>
          </div>
          {(jumpMessage || walletDeeds.length > 0) ? <div className="world-wallet-results" role="status">{jumpMessage ? <p>{jumpMessage}</p> : null}{walletDeeds.length ? <div>{walletDeeds.map((deed) => <Link prefetch={false} href={`/land/${deed.tokenId}`} key={deed.tokenId}><span>LORE DEED #{deed.tokenId}</span><strong>{deed.communityName || `Lore Land #${deed.tokenId}`}</strong><b>Visit ↗</b></Link>)}</div> : null}</div> : null}
        </div>
      </section>

      <section className="trait-atlas-panel" aria-labelledby="trait-atlas-title">
        <div className="trait-atlas-head"><div><span className="land-section-kicker">CANONICAL DISCOVERY</span><h2 id="trait-atlas-title">Study what appeared</h2><p>Explore the world by exact canonical signs. Counts use all 2,869 revealed Lore Lands.</p></div>{traitType && traitValueFilter ? <button type="button" onClick={() => { setTraitType(""); setTraitValueFilter(""); }}>Clear sign ×</button> : null}</div>
        <div className="trait-atlas-groups">
          {groups.map((group) => (
            <details className="trait-atlas-group" key={group.traitType} open={group.traitType === traitType}>
              <summary><span>{group.traitType}</span><b>{group.values.length} signs</b><i>⌄</i></summary>
              <div className="trait-atlas-values">
                {group.values.map((item) => <button type="button" key={`${group.traitType}:${item.value}`} className={traitType === group.traitType && traitValueFilter === item.value ? "is-active" : ""} onClick={() => chooseTrait(group.traitType, item.value)}><strong>{item.value}</strong><span>{item.count.toLocaleString()} lands</span><em>{item.percentage.toFixed(item.percentage < 1 ? 2 : 1)}%</em></button>)}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="world-atlas-section" id="atlas-results">
        <div className="world-atlas-head">
          <div><span>THE WORLD ATLAS</span><h2>{loading ? "Opening the atlas…" : activeDiscovery ? `${activeDiscovery.value} · ${total.toLocaleString()} lands` : `${total.toLocaleString()} lands to explore`}</h2><p>{activeDiscovery ? `${activeDiscovery.percentage.toFixed(activeDiscovery.percentage < 1 ? 2 : 1)}% of the canonical collection carries this sign.` : "Canonical lands appear here whether or not a keeper has written a community profile."}</p></div>
          <div className="world-atlas-head-actions"><Link prefetch={false} href="/taboshi1#land">My Land</Link><Link prefetch={false} href="/world/exchange" className="is-exchange">Market</Link></div>
        </div>

        <div className="world-atlas-toolbar"><label><span>SEARCH THE WORLD</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Land, keeper, trait, #30…" /></label>{traitType && traitValueFilter ? <div className="world-active-filter"><span>{traitType}</span><b>{traitValueFilter}</b><button type="button" onClick={() => { setTraitType(""); setTraitValueFilter(""); }}>×</button></div> : null}</div>

        {!loading && lands.length === 0 ? <div className="world-empty"><TobyworldIcon kind="lore" size={58} className="tw-placeholder-lore" /><h3>No land matched that trail.</h3><p>Clear a sign or try another land name, keeper, trait, or deed number.</p></div> : <div className={`world-land-grid ${loading ? "is-loading" : ""}`}>{lands.map((land) => {
          const signs = compactSigns(land);
          const landSign = traitValue(land, "Land");
          return <Link prefetch={false} key={land.tokenId} href={`/land/${land.tokenId}`} className="world-land-pill">
            <span className="world-land-pill-mark" aria-hidden="true">△</span>
            <div className="world-land-pill-main"><small>DEED #{land.tokenId}</small><strong>{landSign || "Canonical Land"}</strong></div>
            <div className="world-land-pill-signs">{signs.filter((sign) => sign.traitType.toLowerCase() !== "land").slice(0, 2).map((sign) => <span key={`${sign.traitType}:${sign.value}`}>{sign.value}</span>)}</div>
            <div className="world-land-pill-keeper"><small>{land.keeperName ? "KEEPER" : "STATUS"}</small><b>{land.keeperName || "Open mark"}</b></div>
            <i>→</i>
          </Link>;
        })}</div>}

        {pageCount > 1 ? <nav className="world-pagination" aria-label="Atlas pages"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Previous</button><span>Page <b>{page}</b> of {pageCount}</span><button type="button" disabled={page >= pageCount || loading} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next →</button></nav> : null}
      </section>
    </>
  );
}
