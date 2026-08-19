"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { base } from "viem/chains";
import { useReadContract } from "wagmi";
import { LORE_COLLECTION_ADDRESS, LORE_DEEDS_ABI } from "@/lib/lore-deeds";
import {
  fetchLoreMetadataResult,
  loreImageCandidates,
  type LoreMetadataResult,
} from "@/lib/lore-metadata";

export default function LoreDeedArt({
  tokenId,
  label,
  className = "",
  eager = false,
  showStatus = false,
}: {
  tokenId: string | bigint;
  label?: string;
  className?: string;
  eager?: boolean;
  showStatus?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(eager);
  const [result, setResult] = useState<LoreMetadataResult | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [serverFallbackTried, setServerFallbackTried] = useState(false);

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
    args: visible ? [id] : undefined,
    chainId: base.id,
    query: {
      enabled: visible,
      staleTime: 30 * 60_000,
      gcTime: 60 * 60_000,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  });

  useEffect(() => {
    if (!visible || typeof uriRead.data !== "string") return;
    let cancelled = false;
    setImageIndex(0);
    setServerFallbackTried(false);
    fetchLoreMetadataResult(uriRead.data).then((value) => {
      if (!cancelled) setResult(value);
    });
    return () => { cancelled = true; };
  }, [uriRead.data, visible]);

  useEffect(() => {
    if (
      !visible ||
      serverFallbackTried ||
      !result ||
      (!result.error && (result.metadata || result.directImage))
    ) {
      return;
    }

    let cancelled = false;
    setServerFallbackTried(true);

    fetch(`/api/lore/metadata?tokenId=${id.toString()}`, { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Lore metadata fallback unavailable.");
        return response.json();
      })
      .then((body) => {
        if (cancelled) return;
        const metadata =
          body?.metadata && typeof body.metadata === "object"
            ? body.metadata
            : null;

        setResult({
          metadata,
          sourceUri: typeof body?.tokenUri === "string" ? body.tokenUri : result.sourceUri,
          resolvedMetadataUri:
            typeof body?.metadataUri === "string" ? body.metadataUri : result.resolvedMetadataUri,
          directImage:
            typeof body?.image === "string" && !metadata ? body.image : null,
          error:
            metadata || body?.image
              ? null
              : typeof body?.error === "string"
                ? body.error
                : result.error,
        });
        setImageIndex(0);
      })
      .catch(() => {})
      .finally(() => {});

    return () => {
      cancelled = true;
    };
  }, [id, result, serverFallbackTried, visible]);

  const images = useMemo(
    () => {
      const candidates = loreImageCandidates(result?.metadata, result?.directImage);
      // If the server returned a raw IPFS image string inside metadata, this
      // helper expands it into browser-safe gateway candidates.
      return candidates;
    },
    [result],
  );
  const image = images[imageIndex] || null;
  const metadataName = result?.metadata?.name || label || `Lore Land #${id}`;
  const loading = visible && (uriRead.isLoading || (typeof uriRead.data === "string" && !result));

  return (
    <div ref={ref} className={`canonical-deed-art ${image ? "has-image" : "is-metadata-fallback"} ${className}`}>
      {image ? (
        <img
          src={image}
          alt={metadataName}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setImageIndex((index) => index + 1)}
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
      {showStatus && typeof uriRead.data === "string" ? (
        <span className={`canonical-deed-source ${image ? "ready" : ""}`}>
          {image ? "CANONICAL ART ✓" : result?.error ? "TOKEN URI FOUND" : "METADATA FOUND"}
        </span>
      ) : null}
    </div>
  );
}
