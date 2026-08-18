"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";

type OwnedDeed = {
  tokenId: string;
  communityName?: string | null;
  bannerTheme?: "moss" | "moon" | "lotus" | "ember";
};

type OwnedResponse = {
  deeds?: OwnedDeed[];
  complete?: boolean;
};

const CACHE_MS = 10 * 60_000;

function storageKey(owner: Address) {
  return `tobyswap:lore-deeds:${owner.toLowerCase()}`;
}

function readCached(owner: Address): { at: number; data: OwnedResponse } | null {
  try {
    const raw = sessionStorage.getItem(storageKey(owner));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.at === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function writeCached(owner: Address, data: OwnedResponse) {
  try { sessionStorage.setItem(storageKey(owner), JSON.stringify({ at: Date.now(), data })); } catch {}
}

export default function MyLoreDeeds({ owner, expectedCount, revealed }: { owner?: Address; expectedCount: bigint; revealed: boolean }) {
  const [deeds, setDeeds] = useState<OwnedDeed[]>([]);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(true);

  useEffect(() => {
    if (!owner || expectedCount === 0n) {
      setDeeds([]);
      setComplete(true);
      return;
    }

    const cached = readCached(owner);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      setDeeds(cached.data.deeds || []);
      setComplete(cached.data.complete !== false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/land/owned?owner=${encodeURIComponent(owner)}`, { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("deeds unavailable");
        return response.json() as Promise<OwnedResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        setDeeds(data.deeds || []);
        setComplete(data.complete !== false);
        writeCached(owner, data);
      })
      .catch(() => {
        if (!cancelled) { setDeeds([]); setComplete(false); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [owner, expectedCount]);

  const count = Number(expectedCount > 999n ? 999n : expectedCount);
  const missingCount = Math.max(0, count - deeds.length);
  const sorted = useMemo(() => [...deeds].sort((a, b) => Number(a.tokenId) - Number(b.tokenId)), [deeds]);

  if (!owner || expectedCount === 0n) return null;

  return (
    <div className="mytw-owned-deeds">
      <div className="mytw-owned-deeds-head">
        <div><span>MY DEED{expectedCount === 1n ? "" : "S"}</span><strong>{loading ? "Finding your land…" : `${expectedCount.toLocaleString()} held`}</strong></div>
        <a href="/world">Explore World ↗</a>
      </div>

      {sorted.length > 0 ? (
        <div className="mytw-deed-strip">
          {sorted.map((deed) => (
            <a key={deed.tokenId} href={`/land/${deed.tokenId}`} className={`mytw-deed-chip theme-${deed.bannerTheme || "moss"}`}>
              <span className="mytw-deed-chip-rune">△</span>
              <span><small>{deed.communityName || "LORE LAND"}</small><strong>#{deed.tokenId}</strong><em>{revealed ? "Visit land" : "Veiled deed"}</em></span>
              <b>→</b>
            </a>
          ))}
        </div>
      ) : !loading ? (
        <div className="mytw-deed-fallback">Your wallet carries land. Enter a deed number below to open it.</div>
      ) : null}

      {!complete && missingCount > 0 && sorted.length > 0 && (
        <p className="mytw-deed-note">Showing the deed numbers currently found for this wallet. You can still open any known deed below.</p>
      )}
    </div>
  );
}
