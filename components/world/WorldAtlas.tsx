"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isAddress } from "viem";
import { readWorldLandDirectory, type WorldLandSummary } from "@/lib/land-directory";

type WalletDeed = {
  tokenId: string;
  communityName?: string | null;
};

export default function WorldAtlas() {
  const router = useRouter();
  const [lands, setLands] = useState<WorldLandSummary[]>([]);
  const [query, setQuery] = useState("");
  const [jumpValue, setJumpValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [jumpLoading, setJumpLoading] = useState(false);
  const [jumpMessage, setJumpMessage] = useState("");
  const [walletDeeds, setWalletDeeds] = useState<WalletDeed[]>([]);

  useEffect(() => {
    let cancelled = false;
    readWorldLandDirectory()
      .then((rows) => { if (!cancelled) setLands(rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lands;
    return lands.filter(
      (land) =>
        land.tokenId.includes(q) ||
        land.communityName?.toLowerCase().includes(q) ||
        land.description?.toLowerCase().includes(q),
    );
  }, [lands, query]);

  const cleanJump = jumpValue.trim();
  const numericJump = /^#?\d+$/.test(cleanJump) ? cleanJump.replace(/^#/, "") : "";
  const walletJump = isAddress(cleanJump);
  const canJump = Boolean(numericJump || walletJump);

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
      if (deeds.length === 0) {
        setJumpMessage("No canonical Lore Deeds were found in that wallet.");
        return;
      }
      if (deeds.length === 1) {
        router.push(`/land/${deeds[0].tokenId}`);
        return;
      }

      setWalletDeeds(deeds);
      setJumpMessage(`${deeds.length} Lore Deeds found — choose a land.`);
    } catch (error: any) {
      setJumpMessage(error?.message || "The wallet trail could not be followed.");
    } finally {
      setJumpLoading(false);
    }
  }

  return (
    <>
      <section className="world-search-panel">
        <div className="world-search-copy">
          <span>EXPLORE THE LAND</span>
          <h2>Find your way into Tobyworld</h2>
          <p>Search named community lands, jump straight to a deed, or paste any wallet address to find the Lore Deeds it holds.</p>
        </div>

        <div className="world-search-controls">
          <label className="world-search-field">
            <span>SEARCH THE ATLAS</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Land name, story, or #742" />
          </label>

          <div className={`world-deed-jump ${walletJump ? "is-wallet" : numericJump ? "is-deed" : ""}`}>
            <div className="world-jump-mark" aria-hidden="true">
              {walletJump ? "◈" : "△"}
            </div>
            <label>
              <span>OPEN A LAND</span>
              <input
                value={jumpValue}
                onChange={(event) => {
                  setJumpValue(event.target.value);
                  setJumpMessage("");
                  setWalletDeeds([]);
                }}
                onKeyDown={(event) => { if (event.key === "Enter") void openJump(); }}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="#742 or 0x wallet"
                aria-label="Lore Deed number or wallet address"
              />
              <small>{walletJump ? "Wallet detected" : numericJump ? `Lore Deed #${numericJump}` : "Deed number or Base wallet"}</small>
            </label>
            <button type="button" onClick={() => void openJump()} disabled={!canJump || jumpLoading}>
              {jumpLoading ? "Finding…" : walletJump ? "Find lands →" : "Enter →"}
            </button>
          </div>

          {(jumpMessage || walletDeeds.length > 0) ? (
            <div className={`world-wallet-results ${walletDeeds.length ? "has-deeds" : ""}`} role="status">
              {jumpMessage ? <p>{jumpMessage}</p> : null}
              {walletDeeds.length ? (
                <div>
                  {walletDeeds.map((deed) => (
                    <Link prefetch={false} href={`/land/${deed.tokenId}`} key={deed.tokenId}>
                      <span>DEED #{deed.tokenId}</span>
                      <strong>{deed.communityName || `Lore Land #${deed.tokenId}`}</strong>
                      <b>Visit ↗</b>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="world-atlas-section">
        <div className="world-atlas-head">
          <div>
            <span>COMMUNITY LANDS</span>
            <h2>{loading ? "Opening the atlas…" : `${filtered.length} place${filtered.length === 1 ? "" : "s"} to explore`}</h2>
          </div>
          <div className="world-atlas-head-actions">
            <Link prefetch={false} href="/taboshi1#land">My Land</Link>
            <Link prefetch={false} href="/world/exchange" className="is-exchange">Market</Link>
          </div>
        </div>

        {!loading && filtered.length === 0 ? (
          <div className="world-empty">
            <span>△</span>
            <h3>{lands.length === 0 ? "The atlas is waiting for its first names." : "No land matched that trail."}</h3>
            <p>{lands.length === 0 ? "Landowners can name their place from their public land page." : "Try a deed number, wallet, or land name."}</p>
          </div>
        ) : (
          <div className="world-land-grid">
            {filtered.map((land) => (
              <Link prefetch={false} key={land.tokenId} href={`/land/${land.tokenId}`} className={`world-land-card theme-${land.bannerTheme}`}>
                <div className="world-land-scene" aria-hidden="true">
                  <span className="world-land-sky" /><span className="world-land-moon" /><span className="world-land-hill h1" /><span className="world-land-hill h2" /><span className="world-land-water" /><span className="world-land-rune">△</span>
                </div>
                <div className="world-land-copy">
                  <span className="world-land-id">LORE LAND #{land.tokenId}</span>
                  <h3>{land.communityName || `Land #${land.tokenId}`}</h3>
                  <p>{land.description || "A place in Tobyworld waiting to tell more of its story."}</p>
                  <div><small>LORE DEED #{land.tokenId}</small><b>Visit Land →</b></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
