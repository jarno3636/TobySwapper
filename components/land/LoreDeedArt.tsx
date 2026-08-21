"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { base } from "viem/chains";
import { useReadContract } from "wagmi";
import { LORE_COLLECTION_ADDRESS, LORE_DEEDS_ABI } from "@/lib/lore-deeds";
import {
  fetchLoreMetadataResult,
  loreImageCandidates,
  type LoreMetadata,
  type LoreMetadataResult,
} from "@/lib/lore-metadata";

export default function LoreDeedArt({
  tokenId,
  label,
  className = "",
  eager = false,
  showStatus = false,
  revealed = false,
  authoritative = false,
  metadataOverride = null,
  directImageOverride = null,
}: {
  tokenId: string | bigint;
  label?: string;
  className?: string;
  eager?: boolean;
  showStatus?: boolean;
  revealed?: boolean;
  authoritative?: boolean;
  metadataOverride?: LoreMetadata | null;
  directImageOverride?: string | null;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(eager);
  const [result, setResult] = useState<LoreMetadataResult | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [proxyTried, setProxyTried] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const id = typeof tokenId === "bigint" ? tokenId : BigInt(tokenId);

  useEffect(() => {
    if (eager || visible) return;
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "180px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [eager, visible]);

  const uriRead = useReadContract({
    address: LORE_COLLECTION_ADDRESS,
    abi: LORE_DEEDS_ABI,
    functionName: "tokenURI",
    args: visible && !authoritative ? [id] : undefined,
    chainId: base.id,
    query: {
      enabled: visible && !authoritative,
      staleTime: revealed ? 15_000 : 5 * 60_000,
      gcTime: 60 * 60_000,
      refetchInterval: false,
      refetchOnWindowFocus: revealed,
      retry: 1,
    },
  });

  useEffect(() => {
    if (visible && revealed && !authoritative) void uriRead.refetch();
  }, [visible, revealed, id, authoritative]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setImageIndex(0);
    setProxyTried(false);
    setImageLoaded(false);

    if (authoritative) {
      setResult({
        metadata: metadataOverride,
        sourceUri: null,
        resolvedMetadataUri: null,
        directImage: directImageOverride,
        error: metadataOverride || directImageOverride ? null : "Waiting for revealed metadata.",
      });
      return;
    }

    if (!visible || typeof uriRead.data !== "string") return;
    let cancelled = false;
    fetchLoreMetadataResult(uriRead.data, revealed).then((value) => {
      if (!cancelled) setResult(value);
    });
    return () => { cancelled = true; };
  }, [uriRead.data, visible, revealed, authoritative, metadataOverride, directImageOverride]);

  const images = useMemo(
    () => {
      const candidates = loreImageCandidates(result?.metadata, result?.directImage);
      // If the server returned a raw IPFS image string inside metadata, this
      // helper expands it into browser-safe gateway candidates.
      return candidates;
    },
    [result],
  );
  const directImage = images[imageIndex] || null;
  const proxyImage =
    visible && result && !directImage && !proxyTried
      ? `/api/lore/image?tokenId=${id.toString()}${revealed ? "&fresh=1&v=revealed" : ""}`
      : null;
  const image = directImage || proxyImage;
  const usingProxy = Boolean(proxyImage && !directImage);
  const metadataName = result?.metadata?.name || label || `Lore Land #${id}`;
  const loading = visible && (authoritative ? !metadataOverride && !directImageOverride : (uriRead.isLoading || (typeof uriRead.data === "string" && !result)));

  return (
    <div ref={ref} className={`canonical-deed-art ${image ? "has-image" : "is-metadata-fallback"} ${className}`}>
      {image ? (
        <img
          src={image}
          alt={metadataName}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageLoaded(false);
            if (usingProxy) setProxyTried(true);
            else setImageIndex((index) => index + 1);
          }}
        />
      ) : (
        <div className="canonical-deed-metadata-fallback">
          <span className="canonical-deed-mark">△</span>
          <strong>{loading ? "Loading canonical deed…" : "Canonical deed"}</strong>
          <small>
            {loading
              ? "Reading token metadata"
              : result?.error || "Artwork is not exposed by the current metadata."}
          </small>
        </div>
      )}
      <span className="canonical-deed-art-id">#{id.toString()}</span>
      {showStatus && (authoritative || typeof uriRead.data === "string") ? (
        <span className={`canonical-deed-source ${imageLoaded ? "ready" : ""}`}>
          {imageLoaded ? "CANONICAL ART ✓" : image ? "LOADING CANONICAL ART…" : revealed ? "REFRESHING REVEALED ART…" : result?.error ? "TOKEN URI FOUND" : "METADATA FOUND"}
        </span>
      ) : null}
    </div>
  );
}
