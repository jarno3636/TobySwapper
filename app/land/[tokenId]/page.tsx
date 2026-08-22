"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Address } from "viem";
import { base } from "viem/chains";
import { useParams } from "next/navigation";
import { useReadContract } from "wagmi";
import MiniAppGate from "@/components/MiniAppGate";
import Footer from "@/components/Footer";
import PondDock from "@/components/PondDock";
import LandIdentity from "@/components/land/LandIdentity";
import LandTraits from "@/components/land/LandTraits";
import LoreDeedArt from "@/components/land/LoreDeedArt";
import LandVault from "@/components/land/LandVault";
import LandShareActions from "@/components/land/LandShareActions";
import LandExchangePreview from "@/components/world/LandExchangePreview";
import LandCommunityProfile from "@/components/land/LandCommunityProfile";
import LandKeeperStory from "@/components/land/LandKeeperStory";
import { LORE_COLLECTION_ADDRESS, LORE_DEEDS_ABI } from "@/lib/lore-deeds";
import { fetchLoreMetadataResult, type LoreMetadata, type LoreMetadataResult } from "@/lib/lore-metadata";
import { clearCachedLoreMetadata, readCachedLoreMetadata, type CachedLoreMetadata } from "@/lib/lore-cache";

const METADATA_REFRESH_COOLDOWN_MS = 30_000;

const readQuery = {
  staleTime: 120_000,
  refetchInterval: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  retry: 1,
} as const;


export default function LandPage() {
  const params = useParams<{ tokenId: string }>();
  const rawId = params?.tokenId || "";
  const tokenId = useMemo(() => (/^\d+$/.test(rawId) && BigInt(rawId) > 0n ? BigInt(rawId) : null), [rawId]);
  const [metadata, setMetadata] = useState<LoreMetadata | null>(null);
  const [metadataResult, setMetadataResult] = useState<LoreMetadataResult | null>(null);
  const [cachedLore, setCachedLore] = useState<CachedLoreMetadata | null>(null);
  const [cacheChecked, setCacheChecked] = useState(false);
  const [metadataRefreshing, setMetadataRefreshing] = useState(false);
  const [refreshCooldownUntil, setRefreshCooldownUntil] = useState(0);
  const [refreshClock, setRefreshClock] = useState(() => Date.now());
  const refreshLock = useRef(false);

  const ownerRead = useReadContract({
    address: LORE_COLLECTION_ADDRESS,
    abi: LORE_DEEDS_ABI,
    functionName: "ownerOf",
    args: tokenId === null ? undefined : [tokenId],
    chainId: base.id,
    query: { ...readQuery, enabled: tokenId !== null },
  });
  const uriRead = useReadContract({
    address: LORE_COLLECTION_ADDRESS,
    abi: LORE_DEEDS_ABI,
    functionName: "tokenURI",
    args: tokenId === null ? undefined : [tokenId],
    chainId: base.id,
    query: { ...readQuery, enabled: tokenId !== null },
  });
  const travelRead = useReadContract({
    address: LORE_COLLECTION_ADDRESS,
    abi: LORE_DEEDS_ABI,
    functionName: "transferNonce",
    args: tokenId === null ? undefined : [tokenId],
    chainId: base.id,
    query: { ...readQuery, enabled: tokenId !== null },
  });
  const genesisRead = useReadContract({
    address: LORE_COLLECTION_ADDRESS,
    abi: LORE_DEEDS_ABI,
    functionName: "genesisSealed",
    chainId: base.id,
    query: readQuery,
  });

  const revealedRead = useReadContract({
    address: LORE_COLLECTION_ADDRESS,
    abi: LORE_DEEDS_ABI,
    functionName: "revealed",
    chainId: base.id,
    query: {
      staleTime: 15_000,
      refetchInterval: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: "always",
      retry: 1,
    },
  });

  const owner = typeof ownerRead.data === "string" ? ownerRead.data as Address : undefined;
  const transferNonce = typeof travelRead.data === "bigint" ? travelRead.data : 0n;

  const loreRevealed = revealedRead.data === true;
  const refreshCooldownRemaining = Math.max(0, refreshCooldownUntil - refreshClock);
  const refreshCooldownSeconds = Math.ceil(refreshCooldownRemaining / 1000);
  const refreshBlocked = metadataRefreshing || refreshCooldownRemaining > 0;

  // Persist the refresh cooldown per deed so reloading the page cannot be used
  // to hammer the fresh metadata resolver. This is only a UI/request guard; it
  // adds no polling or server infrastructure.
  useEffect(() => {
    if (tokenId === null || typeof window === "undefined") {
      setRefreshCooldownUntil(0);
      return;
    }
    try {
      const stored = Number(window.localStorage.getItem(`tobyswap:lore-refresh:${tokenId.toString()}`) || "0");
      setRefreshCooldownUntil(Number.isFinite(stored) && stored > Date.now() ? stored : 0);
    } catch {
      setRefreshCooldownUntil(0);
    }
  }, [tokenId]);

  useEffect(() => {
    if (refreshCooldownUntil <= Date.now()) return;
    setRefreshClock(Date.now());
    const timer = window.setInterval(() => {
      const now = Date.now();
      setRefreshClock(now);
      if (now >= refreshCooldownUntil) {
        window.clearInterval(timer);
        setRefreshCooldownUntil(0);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [refreshCooldownUntil]);

  // Fast path after reveal: use the public Supabase cache first. The contract remains
  // authoritative, but a backfilled land can render metadata, traits and cached art
  // immediately without waiting on IPFS or a Vercel proxy.
  useEffect(() => {
    if (!loreRevealed || tokenId === null) {
      setCachedLore(null);
      setCacheChecked(true);
      return;
    }
    let cancelled = false;
    setCacheChecked(false);
    readCachedLoreMetadata(tokenId).then((cached) => {
      if (cancelled) return;
      setCachedLore(cached);
      if (cached?.metadata) {
        setMetadata(cached.metadata);
        setMetadataResult(cached);
      }
      setCacheChecked(true);
    });
    return () => { cancelled = true; };
  }, [tokenId, loreRevealed]);

  async function refreshMetadata() {
    if (tokenId === null || metadataRefreshing || refreshLock.current) return;

    const now = Date.now();
    if (refreshCooldownUntil > now) return;

    // Lock synchronously before React state updates so rapid taps cannot race.
    refreshLock.current = true;
    const nextAllowedAt = now + METADATA_REFRESH_COOLDOWN_MS;
    setRefreshCooldownUntil(nextAllowedAt);
    setRefreshClock(now);
    try {
      window.localStorage.setItem(`tobyswap:lore-refresh:${tokenId.toString()}`, String(nextAllowedAt));
    } catch {}

    setMetadataRefreshing(true);
    try {
      clearCachedLoreMetadata(tokenId);
      setCachedLore(null);
      const response = await fetch(`/api/lore/metadata?tokenId=${tokenId.toString()}&fresh=1`, { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        if (payload?.metadata && typeof payload.metadata === "object") {
          const next: LoreMetadataResult = {
            metadata: payload.metadata as LoreMetadata,
            sourceUri: typeof payload.tokenUri === "string" ? payload.tokenUri : null,
            resolvedMetadataUri: typeof payload.metadataUri === "string" ? payload.metadataUri : null,
            directImage: typeof payload.cachedImageUrl === "string" ? payload.cachedImageUrl : (typeof payload.image === "string" ? payload.image : null),
            error: null,
          };
          setMetadata(next.metadata);
          setMetadataResult(next);
        }
      }
      void uriRead.refetch();
    } finally {
      setMetadataRefreshing(false);
      refreshLock.current = false;
    }
  }

  useEffect(() => {
    if (loreRevealed) void uriRead.refetch();
  }, [loreRevealed, tokenId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cachedLore?.metadata && loreRevealed) return;
    if (typeof uriRead.data !== "string") {
      setMetadata(null);
      setMetadataResult(null);
      return;
    }
    let cancelled = false;
    fetchLoreMetadataResult(uriRead.data, loreRevealed).then(async (result) => {
      if (cancelled) return;

      // Public IPFS gateways can occasionally reject browser requests even when
      // the metadata is healthy. Once the contract says reveal is live, use the
      // existing server resolver only as a fallback so the normal path stays
      // client-side and Hobby-tier friendly.
      if (loreRevealed && result.error && tokenId !== null) {
        try {
          const response = await fetch(`/api/lore/metadata?tokenId=${tokenId.toString()}`, { cache: "no-store" });
          if (response.ok) {
            const payload = await response.json();
            if (!cancelled && payload?.metadata && typeof payload.metadata === "object") {
              const fallbackResult: LoreMetadataResult = {
                metadata: payload.metadata as LoreMetadata,
                sourceUri: typeof payload.tokenUri === "string" ? payload.tokenUri : uriRead.data,
                resolvedMetadataUri: typeof payload.metadataUri === "string" ? payload.metadataUri : null,
                directImage: payload.source === "direct-image" && typeof payload.image === "string" ? payload.image : null,
                error: null,
              };
              setMetadata(fallbackResult.metadata);
              setMetadataResult(fallbackResult);
              return;
            }
          }
        } catch {}
      }

      if (!cancelled) {
        setMetadata(result.metadata);
        setMetadataResult(result);
      }
    });
    return () => { cancelled = true; };
  }, [uriRead.data, loreRevealed, cachedLore]);

  const hasArtwork = Boolean(
    metadataResult?.directImage ||
    metadata?.image ||
    metadata?.image_url ||
    metadata?.imageUrl
  );
  const missing = tokenId === null || Boolean(ownerRead.error);

  return (
    <MiniAppGate>
      <main className="land-page mx-auto w-full max-w-5xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
        <header className="land-topbar">
          <Link prefetch={false} href="/taboshi1" className="land-back">← My Tobyworld</Link>
          <Link prefetch={false} href="/world" className="land-world-link">Explore World ↗</Link>
        </header>

        {missing ? (
          <section className="land-not-found">
            <span>△</span><h1>The land stayed behind the veil.</h1>
            <p>That deed ID is not minted, could not be read, or is not a valid Lore Land token.</p>
            <Link prefetch={false} href="/taboshi1">Return to My Tobyworld</Link>
          </section>
        ) : (
          <>
            <LandCommunityProfile tokenId={tokenId!} owner={owner} transferNonce={transferNonce} />

            <section className="land-showcase" aria-label={`Lore Land #${tokenId!.toString()}`}>
              <div className="land-hero-deed-wrap land-showcase-art">
                <div className="land-hero-deed-label">
                  <span><i aria-hidden="true" /> REVEALED CANONICAL LAND</span>
                  <strong>DEED #{tokenId!.toString()}</strong>
                </div>
                <LoreDeedArt
                  tokenId={tokenId!}
                  label={metadata?.name}
                  className="land-hero-canonical-deed"
                  eager
                  showStatus
                  revealed={loreRevealed}
                  authoritative={Boolean(cachedLore?.metadata || metadata)}
                  metadataOverride={metadata}
                  directImageOverride={cachedLore?.directImage || metadataResult?.directImage || null}
                />
                <div className="land-showcase-tools">
                  <button
                    className="land-refresh-mini"
                    type="button"
                    onClick={refreshMetadata}
                    disabled={refreshBlocked}
                    aria-label={refreshCooldownSeconds > 0 ? `Refresh available in ${refreshCooldownSeconds} seconds` : "Refresh land"}
                    title={refreshCooldownSeconds > 0 ? `Refresh available in ${refreshCooldownSeconds}s` : "Refresh land metadata"}
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15.8 7.1A6.25 6.25 0 1 0 16 12"/><path d="M15.8 3.8v3.7h-3.7"/></svg>
                    {metadataRefreshing ? "Refreshing…" : refreshCooldownSeconds > 0 ? `${refreshCooldownSeconds}s` : "Refresh"}
                  </button>
                </div>
              </div>

              <LandTraits
                tokenId={tokenId}
                metadata={metadata}
                revealed={loreRevealed}
                loading={!cacheChecked || metadataRefreshing}
                error={metadataResult?.error || null}
                onRefresh={refreshBlocked ? undefined : refreshMetadata}
              />

            </section>

            <LandKeeperStory tokenId={tokenId!} owner={owner} transferNonce={transferNonce} />

            <LandVault tokenId={tokenId!} owner={owner} />

            <section className="land-public-actions">
              <div><span className="land-section-kicker">CARRY THE STORY</span><h2>Share this place</h2><p>Send another visitor here, or carry this land beyond the edge of the map.</p></div>
              <LandShareActions tokenId={tokenId!} />
            </section>

            <LandIdentity tokenId={tokenId!} owner={owner} hasArtwork={hasArtwork} travels={transferNonce} genesisSealed={genesisRead.data === true} />

            <LandExchangePreview compact />

          </>
        )}
      </main>
      <Footer />
      <PondDock active="world" />
    </MiniAppGate>
  );
}
