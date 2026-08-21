"use client";

import Link from "next/link";
import { PouchLandTransfer } from "@/components/land/PouchLandTransfer";
import LoreDeedArt from "@/components/land/LoreDeedArt";
import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { LORE_COLLECTION_ADDRESS } from "@/lib/lore-deeds";

type OwnedDeed = {
  tokenId: string;
  communityName?: string | null;
  bannerTheme?: "moss" | "moon" | "lotus" | "ember" | "tide" | "dusk" | "bloom" | "gold";
};

type OwnedResponse = {
  deeds?: OwnedDeed[];
  complete?: boolean;
};

const CACHE_MS = 30 * 60_000;
const memory = new Map<string, { at: number; data: OwnedResponse }>();
const inflight = new Map<string, Promise<OwnedResponse>>();

function storageKey(owner: Address) { return `tobyswap:canonical-lore-deeds:v2:${LORE_COLLECTION_ADDRESS.toLowerCase()}:${owner.toLowerCase()}`; }
function ownerKey(owner: Address) { return owner.toLowerCase(); }

function readCached(owner: Address): { at: number; data: OwnedResponse } | null {
  const hot = memory.get(ownerKey(owner));
  if (hot && Date.now() - hot.at < CACHE_MS) return hot;
  try {
    const raw = localStorage.getItem(storageKey(owner));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.at === "number") {
      memory.set(ownerKey(owner), parsed);
      return parsed;
    }
  } catch {}
  return null;
}

function writeCached(owner: Address, data: OwnedResponse) {
  const entry = { at: Date.now(), data };
  memory.set(ownerKey(owner), entry);
  try { localStorage.setItem(storageKey(owner), JSON.stringify(entry)); } catch {}
}

function loadOwned(owner: Address) {
  const key = ownerKey(owner);
  const existing = inflight.get(key);
  if (existing) return existing;
  const request = fetch(`/api/land/owned?owner=${encodeURIComponent(owner)}`, { cache: "force-cache" })
    .then(async (response) => {
      if (!response.ok) throw new Error("deeds unavailable");
      return response.json() as Promise<OwnedResponse>;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

export default function MyLoreDeeds({ owner, expectedCount, revealed, readOnly = false }: { owner?: Address; expectedCount: bigint; revealed: boolean; readOnly?: boolean }) {
  const [deeds, setDeeds] = useState<OwnedDeed[]>([]);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [visibleCount, setVisibleCount] = useState(6);

  useEffect(() => {
    function onWalletRefresh(event: Event) {
      if (!owner) return;

      // Automatic route-return refreshes should update live balances without
      // re-running the Alchemy ownership endpoint. If the live deed balance
      // changed, the expectedCount/cache-length check below already triggers
      // a fresh ownership lookup. Manual "Refresh Pouch" still clears it.
      const automatic = Boolean(
        (event as CustomEvent<{ automatic?: boolean }>).detail?.automatic,
      );
      if (automatic) return;

      memory.delete(ownerKey(owner));
      try { localStorage.removeItem(storageKey(owner)); } catch {}
      setRefreshNonce((value) => value + 1);
    }

    window.addEventListener("tobyswap:wallet-data-refreshed", onWalletRefresh);
    return () => window.removeEventListener("tobyswap:wallet-data-refreshed", onWalletRefresh);
  }, [owner]);

  useEffect(() => {
    if (!owner || expectedCount === 0n) {
      setDeeds([]);
      setComplete(true);
      return;
    }

    const expected = Number(expectedCount > 999n ? 999n : expectedCount);
    const cached = readCached(owner);

    // Only reuse cached deed IDs when they still agree with the live canonical
    // balance. This prevents a cached empty result surviving route navigation.
    if (
      refreshNonce === 0 &&
      cached &&
      Date.now() - cached.at < CACHE_MS &&
      (cached.data.deeds || []).length === expected
    ) {
      setDeeds(cached.data.deeds || []);
      setComplete(cached.data.complete !== false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    loadOwned(owner)
      .then((data) => {
        if (cancelled) return;
        setDeeds(data.deeds || []);
        setComplete(data.complete !== false);
        writeCached(owner, data);
      })
      .catch(() => {
        if (!cancelled) {
          setDeeds([]);
          setComplete(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [owner, expectedCount, refreshNonce]);

  const count = Number(expectedCount > 999n ? 999n : expectedCount);
  const missingCount = Math.max(0, count - deeds.length);
  const sorted = useMemo(() => [...deeds].sort((a, b) => Number(a.tokenId) - Number(b.tokenId)), [deeds]);
  const visibleDeeds = sorted.slice(0, visibleCount);

  async function copyTokenId(tokenId: string) {
    try {
      await navigator.clipboard.writeText(tokenId);
      setCopied(tokenId);
      window.setTimeout(() => setCopied((current) => current === tokenId ? null : current), 1400);
    } catch {}
  }

  function sendToDeed(tokenId: string) {
    window.dispatchEvent(
      new CustomEvent("tobyswap:select-land-vault", { detail: { tokenId } }),
    );
    window.setTimeout(() => {
      document.getElementById("land-vault-send")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 40);
  }

  if (!owner || expectedCount === 0n) return null;

  return (
    <div className="mytw-owned-deeds">
      <div className="mytw-owned-deeds-head">
        <div><span>{readOnly ? "LORE DEEDS" : `MY LORE DEED${expectedCount === 1n ? "" : "S"}`}</span><strong>{loading ? "Finding land…" : `${expectedCount.toLocaleString()} held`}</strong><small>{sorted.length > 0 ? (readOnly ? "Canonical deed IDs held by this wallet" : "Your deed IDs are shown below") : "Finding token IDs"}</small></div>
        <Link prefetch={false} href="/world">Explore World ↗</Link>
      </div>

      {sorted.length > 0 ? (
        <>
          <div className="mytw-deed-gallery">
            {visibleDeeds.map((deed, index) => (
              <article key={deed.tokenId} className={`mytw-deed-tile theme-${deed.bannerTheme || "moss"}`}>
                <Link prefetch={false} href={`/land/${deed.tokenId}`} className="mytw-deed-art-link" aria-label={`Visit Lore Land #${deed.tokenId}`}>
                  <LoreDeedArt tokenId={deed.tokenId} label={deed.communityName || undefined} eager={index < 2} revealed={revealed} />
                </Link>
                <div className="mytw-deed-tile-copy">
                  <small>{deed.communityName || "LORE LAND"}</small>
                  <strong>Deed #{deed.tokenId}</strong>
                  <span>{revealed ? "Canonical land" : "Veiled land"}</span>
                </div>
                <div className="mytw-deed-tile-actions">
                  <Link prefetch={false} href={`/land/${deed.tokenId}`}>Visit</Link>
                  {!readOnly ? <button type="button" onClick={() => sendToDeed(deed.tokenId)}>Send assets</button> : null}
                  <button type="button" onClick={() => copyTokenId(deed.tokenId)}>
                    {copied === deed.tokenId ? "Copied" : "Copy ID"}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {sorted.length > visibleCount ? (
            <button type="button" className="mytw-deed-more" onClick={() => setVisibleCount((count) => count + 6)}>
              Show {Math.min(6, sorted.length - visibleCount)} more deeds
            </button>
          ) : null}
        </>
      ) : !loading ? (
        <div className="mytw-deed-fallback">Your wallet carries land. Enter a known deed number below to open it.</div>
      ) : null}

      {!complete && missingCount > 0 && sorted.length > 0 && (
        <p className="mytw-deed-note">Showing the deed IDs currently found for this wallet. You can still open any known deed below.</p>
      )}

      {sorted.length > 0 && !readOnly ? (
        <PouchLandTransfer deedIds={sorted.map((deed) => deed.tokenId)} />
      ) : null}
    </div>
  );
}
