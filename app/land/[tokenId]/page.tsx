"use client";

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
import { fetchLoreMetadata, loreImage, type LoreMetadata } from "@/lib/lore-metadata";
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
  const [communityProfile, setCommunityProfile] = useState<LandProfile | null>(null);

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

  useEffect(() => {
    if (typeof uriRead.data !== "string") {
      setMetadata(null);
      return;
    }
    let cancelled = false;
    fetchLoreMetadata(uriRead.data).then((data) => {
      if (!cancelled) setMetadata(data);
    });
    return () => { cancelled = true; };
  }, [uriRead.data]);

  const image = loreImage(metadata);
  const hasArtwork = Boolean(image);
  const missing = tokenId === null || Boolean(ownerRead.error);

  return (
    <MiniAppGate>
      <main className="land-page mx-auto w-full max-w-5xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
        <header className="land-topbar">
          <a href="/taboshi1" className="land-back">← My Tobyworld</a>
          <a href="/world" className="land-world-link">Explore World ↗</a>
        </header>

        {missing ? (
          <section className="land-not-found">
            <span>△</span><h1>The land stayed behind the veil.</h1>
            <p>That deed ID is not minted, could not be read, or is not a valid Lore Land token.</p>
            <a href="/taboshi1">Return to My Tobyworld</a>
          </section>
        ) : (
          <>
            <section className="land-hero">
              <div className="land-hero-copy">
                <span className="land-section-kicker">A PLACE IN TOBYWORLD</span>
                <h1>{communityProfile?.communityName || metadata?.name || `Lore Land #${tokenId!.toString()}`}</h1>
                <p>{communityProfile?.description || metadata?.description || (hasArtwork ? "A place in Tobyworld with a story of its own." : "The deed is real. The landscape still waits behind the veil.")}</p>
                <LandShareActions tokenId={tokenId!} />
              </div>
              <div className={`land-hero-art ${hasArtwork ? "is-revealed" : ""}`}>
                {image ? <img src={image} alt={metadata?.name || `Lore Land #${tokenId}`} /> : <>
                  <span className="land-hero-moon" /><span className="land-hero-island" /><span className="land-hero-water" />
                  <span className="land-hero-rune">△</span>
                  <Image src="/tokens/toby.PNG" alt="" width={86} height={86} className="land-hero-frog" />
                </>}
              </div>
            </section>

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
