"use client";

import Link from "next/link";
import Image from "next/image";
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
import type { LandCommunityProfile as LandProfile } from "@/lib/land-profile";
import { TOBY, PATIENCE, TABOSHI } from "@/lib/addresses";
import { LORE_COLLECTION_ADDRESS, LORE_DEEDS_ABI } from "@/lib/lore-deeds";
import { fetchLoreMetadataResult, looksLikePreRevealMetadata, type LoreMetadata, type LoreMetadataResult } from "@/lib/lore-metadata";
import { clearCachedLoreMetadata, readCachedLoreMetadata } from "@/lib/lore-cache";
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
  const [communityProfile, setCommunityProfile] = useState<LandProfile | null>(null);
  const [metadataRefreshNonce, setMetadataRefreshNonce] = useState(0);
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
      { address: TABOSHI1_ADDRESS, abi: TABOSHI1_ABI, functionName: "balanceOf", args: [owner, TABOSHI1_TOKEN_ID], chainId: base.id },
      { address: TABOSHI_SEEDS_ADDRESS, abi: TABOSHI_SEEDS_ABI, functionName: "balanceOf", args: [owner, TABOSHI_SEED_ID], chainId: base.id },
    ] as const : [],
    query: { ...readQuery, enabled: Boolean(owner) },
  });

  const values = ecosystem.data || [];
  const toby = typeof values[0]?.result === "bigint" ? values[0].result : 0n;
  const patience = typeof values[1]?.result === "bigint" ? values[1].result : 0n;
  const taboshi = typeof values[2]?.result === "bigint" ? values[2].result : 0n;
  const oldLeaf = typeof values[3]?.result === "bigint" ? values[3].result : 0n;
  const seed = typeof values[4]?.result === "bigint" ? values[4].result : 0n;

  const loreRevealed = revealedRead.data === true;

  useEffect(() => {
    if (loreRevealed) void uriRead.refetch();
  }, [loreRevealed, tokenId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;

    const applyResult = (result: LoreMetadataResult) => {
      if (cancelled) return;
      setMetadata(result.metadata);
      setMetadataResult(result);
    };

    const load = async () => {
      // revealed() is the source of truth. Once it is true, never let prereveal
      // local/browser metadata win. Resolve the current tokenURI fresh once.
      if (loreRevealed && tokenId !== null) {
        setMetadataRefreshing(true);
        try {
          // Supabase is a read-through cache only. The canonical contract/tokenURI
          // remains authoritative, but once a revealed token has been validated and
          // stored we can render it without another Vercel/RPC/IPFS round trip.
          if (metadataRefreshNonce === 0) {
            const cached = await readCachedLoreMetadata(tokenId);
            if (cached?.metadata && !looksLikePreRevealMetadata(cached.metadata)) {
              applyResult(cached);
              return;
            }
          }

          const response = await fetch(
            `/api/lore/metadata?tokenId=${tokenId.toString()}&fresh=1&r=${metadataRefreshNonce}`,
            { cache: "no-store", headers: { "cache-control": "no-cache" } },
          );
          const payload = await response.json().catch(() => null);
          if (cancelled) return;

          if (response.ok && payload?.metadata && typeof payload.metadata === "object" && !looksLikePreRevealMetadata(payload.metadata)) {
            applyResult({
              metadata: payload.metadata as LoreMetadata,
              sourceUri: typeof payload.tokenUri === "string" ? payload.tokenUri : null,
              resolvedMetadataUri: typeof payload.metadataUri === "string" ? payload.metadataUri : null,
              directImage: payload.source === "direct-image" && typeof payload.image === "string" ? payload.image : null,
              error: null,
            });
            return;
          }

          applyResult({
            metadata: null,
            sourceUri: typeof payload?.tokenUri === "string" ? payload.tokenUri : null,
            resolvedMetadataUri: null,
            directImage: null,
            error: typeof payload?.error === "string" ? payload.error : "Revealed metadata is refreshing. Try again in a moment.",
          });
        } catch {
          if (!cancelled) applyResult({
            metadata: null,
            sourceUri: null,
            resolvedMetadataUri: null,
            directImage: null,
            error: "Revealed metadata could not be refreshed yet.",
          });
        } finally {
          if (!cancelled) setMetadataRefreshing(false);
        }
        return;
      }

      if (typeof uriRead.data !== "string") {
        if (!cancelled) {
          setMetadata(null);
          setMetadataResult(null);
        }
        return;
      }

      applyResult(await fetchLoreMetadataResult(uriRead.data, false));
    };

    void load();
    return () => { cancelled = true; };
  }, [uriRead.data, loreRevealed, tokenId, metadataRefreshNonce]);

  const refreshCanonicalMetadata = () => {
    if (tokenId !== null) clearCachedLoreMetadata(tokenId);
    void uriRead.refetch();
    setMetadataRefreshNonce((value) => value + 1);
  };

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
            <section className="land-hero">
              <div className="land-hero-copy">
                <span className="land-section-kicker">YOUR PLACE IN TOBYWORLD</span>
                <h1>{communityProfile?.communityName || metadata?.name || `Lore Land #${tokenId!.toString()}`}</h1>
                <p>{communityProfile?.description || metadata?.description || (hasArtwork ? "A place in Tobyworld with a story of its own." : "The deed is real. The landscape still waits behind the veil.")}</p>
                <LandShareActions tokenId={tokenId!} />
              </div>
              <div className="land-hero-deed-wrap">
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
                  authoritative={loreRevealed}
                  metadataOverride={metadata}
                  directImageOverride={metadataResult?.directImage || null}
                />
                {loreRevealed && hasArtwork ? <div className="land-art-caption"><span>YOUR LAND</span><strong>{metadata?.name || `Lore Land Deed #${tokenId!.toString()}`}</strong></div> : null}
                {typeof uriRead.data === "string" ? (
                  <div className="land-metadata-row">
                    <span>{metadataRefreshing ? "Refreshing revealed land…" : metadataResult?.error ? "Revealed metadata needs a refresh" : loreRevealed ? "Reveal live · canonical metadata connected" : "Canonical tokenURI connected"}</span>
                    <div className="land-metadata-actions">
                      {loreRevealed ? (
                        <button type="button" onClick={refreshCanonicalMetadata} disabled={metadataRefreshing}>
                          {metadataRefreshing ? "Refreshing…" : "Refresh metadata"}
                        </button>
                      ) : null}
                      {metadataResult?.resolvedMetadataUri && !metadataResult.resolvedMetadataUri.startsWith("data:") ? (
                        <a href={metadataResult.resolvedMetadataUri} target="_blank" rel="noreferrer">View metadata ↗</a>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <LandTraits metadata={metadata} revealed={loreRevealed} loading={metadataRefreshing} error={metadataResult?.error || null} onRefresh={refreshCanonicalMetadata} />

            <LandCommunityProfile tokenId={tokenId!} owner={owner} onProfile={setCommunityProfile} />

            <LandIdentity tokenId={tokenId!} owner={owner} hasArtwork={hasArtwork} travels={typeof travelRead.data === "bigint" ? travelRead.data : 0n} genesisSealed={genesisRead.data === true} />

            <LandVault tokenId={tokenId!} owner={owner} />

            <div className="land-two-column">
              <LandGarden seedBalance={seed} />
              <LandProductionPlaceholder revealed={hasArtwork} />
            </div>

            <LandRelics toby={toby} patience={patience} taboshi={taboshi} oldLeaf={oldLeaf} seed={seed} />
            <LandExchangePreview compact />

          </>
        )}
      </main>
      <Footer />
      <PondDock active="world" />
    </MiniAppGate>
  );
}
