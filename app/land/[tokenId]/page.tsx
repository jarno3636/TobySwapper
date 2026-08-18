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
import LandGarden from "@/components/land/LandGarden";
import LandRelics from "@/components/land/LandRelics";
import LandProductionPlaceholder from "@/components/land/LandProductionPlaceholder";
import LandShareActions from "@/components/land/LandShareActions";
import { TOBY, PATIENCE, TABOSHI } from "@/lib/addresses";
import { LORE_COLLECTION_ADDRESS, LORE_DEEDS_ABI, resolveLoreUri } from "@/lib/lore-deeds";
import { TABOSHI1_ADDRESS, TABOSHI1_ABI, TABOSHI1_TOKEN_ID } from "@/lib/taboshi1";
import { TABOSHI_SEEDS_ADDRESS, TABOSHI_SEEDS_ABI, TABOSHI_SEED_ID } from "@/lib/taboshi-seeds";

const readQuery = {
  staleTime: 120_000,
  refetchInterval: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  retry: 1,
} as const;

type LoreMetadata = { name?: string; description?: string; image?: string; attributes?: Array<{ trait_type?: string; value?: unknown }> };

export default function LandPage() {
  const params = useParams<{ tokenId: string }>();
  const rawId = params?.tokenId || "";
  const tokenId = useMemo(() => (/^\d+$/.test(rawId) && BigInt(rawId) > 0n ? BigInt(rawId) : null), [rawId]);
  const [metadata, setMetadata] = useState<LoreMetadata | null>(null);

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
  const revealedRead = useReadContract({ address: LORE_COLLECTION_ADDRESS, abi: LORE_DEEDS_ABI, functionName: "revealed", chainId: base.id, query: readQuery });
  const nonceRead = useReadContract({
    address: LORE_COLLECTION_ADDRESS, abi: LORE_DEEDS_ABI, functionName: "transferNonce",
    args: tokenId === null ? undefined : [tokenId], chainId: base.id, query: { ...readQuery, enabled: tokenId !== null },
  });
  const accountRead = useReadContract({
    address: LORE_COLLECTION_ADDRESS, abi: LORE_DEEDS_ABI, functionName: "accountOf",
    args: tokenId === null ? undefined : [tokenId], chainId: base.id, query: { ...readQuery, enabled: tokenId !== null },
  });
  const forgeRead = useReadContract({ address: LORE_COLLECTION_ADDRESS, abi: LORE_DEEDS_ABI, functionName: "communityMinter", chainId: base.id, query: readQuery });

  const owner = typeof ownerRead.data === "string" ? ownerRead.data as Address : undefined;
  const revealed = revealedRead.data === true;
  const transferNonce = typeof nonceRead.data === "bigint" ? nonceRead.data : undefined;
  const boundAccount = typeof accountRead.data === "string" ? accountRead.data as Address : undefined;
  const forge = typeof forgeRead.data === "string" && forgeRead.data !== "0x0000000000000000000000000000000000000000" ? forgeRead.data as Address : undefined;

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
    const uri = typeof uriRead.data === "string" ? resolveLoreUri(uriRead.data) : null;
    if (!uri) { setMetadata(null); return; }
    let cancelled = false;
    fetch(uri, { cache: "force-cache" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (!cancelled && data) setMetadata(data); })
      .catch(() => { if (!cancelled) setMetadata(null); });
    return () => { cancelled = true; };
  }, [uriRead.data]);

  const image = resolveLoreUri(metadata?.image);
  const missing = tokenId === null || Boolean(ownerRead.error);

  return (
    <MiniAppGate>
      <main className="land-page mx-auto w-full max-w-5xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
        <header className="land-topbar">
          <a href="/taboshi1" className="land-back">← My Tobyworld</a>
          <span>PUBLIC LAND ENGINE · BASE</span>
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
                <h1>{metadata?.name || `Lore Land #${tokenId!.toString()}`}</h1>
                <p>{metadata?.description || (revealed ? "A canonical Lore Deed rendered through the TobySwap Land Engine." : "The deed is real. The landscape is still waiting for the canonical reveal.")}</p>
                <LandShareActions tokenId={tokenId!} />
              </div>
              <div className={`land-hero-art ${revealed ? "is-revealed" : ""}`}>
                {image && revealed ? <img src={image} alt={metadata?.name || `Lore Land #${tokenId}`} /> : <>
                  <span className="land-hero-moon" /><span className="land-hero-island" /><span className="land-hero-water" />
                  <span className="land-hero-rune">△</span>
                  <Image src="/tokens/toby.PNG" alt="" width={86} height={86} className="land-hero-frog" />
                </>}
              </div>
            </section>

            <LandIdentity tokenId={tokenId!} owner={owner} revealed={revealed} transferNonce={transferNonce} boundAccount={boundAccount} forge={forge} />

            <div className="land-two-column">
              <LandGarden seedBalance={seed} />
              <LandProductionPlaceholder revealed={revealed} />
            </div>

            <LandRelics toby={toby} patience={patience} taboshi={taboshi} oldLeaf={oldLeaf} seed={seed} />

            <section className="land-discovery-module">
              <div><span className="land-section-kicker">DISCOVERIES</span><h2>What the pond can verify</h2><p>These are observations from the current deed keeper&apos;s onchain state—not promises about future mechanics.</p></div>
              <div className="land-discovery-list">
                <span className={oldLeaf > 0n ? "is-found" : ""}>🍃 {oldLeaf > 0n ? "Old Leaf remembered" : "Old Leaf undiscovered"}</span>
                <span className={seed > 0n ? "is-found" : ""}>🌱 {seed > 0n ? "SEED has taken root" : "The soil is quiet"}</span>
                <span className={patience > 0n ? "is-found" : ""}>🔺 {patience > 0n ? "Patience carried" : "Patience awaits"}</span>
                <span className={taboshi > 0n ? "is-found" : ""}>🐸 {taboshi > 0n ? "Taboshi discovered" : "Taboshi undiscovered"}</span>
              </div>
            </section>

            <section className="land-world-next">
              <span>WORLD LAYER</span><strong>This land page is the foundation.</strong><p>Community names, banners, visitors and exploration can layer on later without changing the canonical deed underneath.</p>
              <a href="/taboshi1">Open My Tobyworld →</a>
            </section>
          </>
        )}
      </main>
      <Footer />
      <PondDock />
    </MiniAppGate>
  );
}
