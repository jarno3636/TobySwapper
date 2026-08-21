"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { erc20Abi, type Address } from "viem";
import { base } from "viem/chains";
import { useParams } from "next/navigation";
import { useReadContract, useReadContracts } from "wagmi";
import MiniAppGate from "@/components/MiniAppGate";
import Footer from "@/components/Footer";
import PondDock from "@/components/PondDock";
import LandIdentity from "@/components/land/LandIdentity";
import LandTraits from "@/components/land/LandTraits";
import LoreDeedArt from "@/components/land/LoreDeedArt";
import LandVault from "@/components/land/LandVault";
import LandGarden from "@/components/land/LandGarden";
import LandRelics from "@/components/land/LandRelics";
import LandProductionPlaceholder from "@/components/land/LandProductionPlaceholder";
import LandShareActions from "@/components/land/LandShareActions";
import LandExchangePreview from "@/components/world/LandExchangePreview";
import LandCommunityProfile from "@/components/land/LandCommunityProfile";
import { TOBY, PATIENCE, TABOSHI, CBBTC } from "@/lib/addresses";
import { LORE_COLLECTION_ADDRESS, LORE_DEEDS_ABI } from "@/lib/lore-deeds";
import { fetchLoreMetadataResult, type LoreMetadata, type LoreMetadataResult } from "@/lib/lore-metadata";
import { clearCachedLoreMetadata, readCachedLoreMetadata, type CachedLoreMetadata } from "@/lib/lore-cache";
import { TABOSHI1_ADDRESS, TABOSHI1_ABI, TABOSHI1_TOKEN_ID } from "@/lib/taboshi1";
import { TABOSHI_SEEDS_ADDRESS, TABOSHI_SEEDS_ABI, TABOSHI_SEED_ID } from "@/lib/taboshi-seeds";

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

  const ecosystem = useReadContracts({
    contracts: owner ? [
      { address: TOBY, abi: erc20Abi, functionName: "balanceOf", args: [owner], chainId: base.id },
      { address: PATIENCE, abi: erc20Abi, functionName: "balanceOf", args: [owner], chainId: base.id },
      { address: TABOSHI, abi: erc20Abi, functionName: "balanceOf", args: [owner], chainId: base.id },
      { address: CBBTC, abi: erc20Abi, functionName: "balanceOf", args: [owner], chainId: base.id },
      { address: TABOSHI1_ADDRESS, abi: TABOSHI1_ABI, functionName: "balanceOf", args: [owner, TABOSHI1_TOKEN_ID], chainId: base.id },
      { address: TABOSHI_SEEDS_ADDRESS, abi: TABOSHI_SEEDS_ABI, functionName: "balanceOf", args: [owner, TABOSHI_SEED_ID], chainId: base.id },
    ] as const : [],
    query: { ...readQuery, enabled: Boolean(owner) },
  });

  const values = ecosystem.data || [];
  const toby = typeof values[0]?.result === "bigint" ? values[0].result : 0n;
  const patience = typeof values[1]?.result === "bigint" ? values[1].result : 0n;
  const taboshi = typeof values[2]?.result === "bigint" ? values[2].result : 0n;
  const cbbtc = typeof values[3]?.result === "bigint" ? values[3].result : 0n;
  const oldLeaf = typeof values[4]?.result === "bigint" ? values[4].result : 0n;
  const seed = typeof values[5]?.result === "bigint" ? values[5].result : 0n;

  const loreRevealed = revealedRead.data === true;

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
    if (tokenId === null || metadataRefreshing) return;
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
            <LandCommunityProfile tokenId={tokenId!} owner={owner} />

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
                  <button className="land-refresh-mini" type="button" onClick={refreshMetadata} disabled={metadataRefreshing} aria-label="Refresh land">
                    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15.8 7.1A6.25 6.25 0 1 0 16 12"/><path d="M15.8 3.8v3.7h-3.7"/></svg>
                    {metadataRefreshing ? "Refreshing…" : "Refresh"}
                  </button>
                </div>
              </div>

              <LandTraits
                metadata={metadata}
                revealed={loreRevealed}
                loading={!cacheChecked || metadataRefreshing}
                error={metadataResult?.error || null}
                onRefresh={refreshMetadata}
              />

              <div className="land-showcase-share">
                <LandShareActions tokenId={tokenId!} />
              </div>
            </section>

            <LandIdentity tokenId={tokenId!} owner={owner} hasArtwork={hasArtwork} travels={typeof travelRead.data === "bigint" ? travelRead.data : 0n} genesisSealed={genesisRead.data === true} />

            <LandVault tokenId={tokenId!} owner={owner} />

            <div className="land-two-column">
              <LandGarden seedBalance={seed} />
              <LandProductionPlaceholder revealed={hasArtwork} />
            </div>

            <LandRelics toby={toby} patience={patience} taboshi={taboshi} cbbtc={cbbtc} oldLeaf={oldLeaf} seed={seed} />
            <LandExchangePreview compact />

          </>
        )}
      </main>
      <Footer />
      <PondDock active="world" />
    </MiniAppGate>
  );
}
