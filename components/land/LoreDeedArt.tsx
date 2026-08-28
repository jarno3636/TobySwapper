"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { base } from "viem/chains";
import { useReadContract } from "wagmi";
import { LORE_COLLECTION_ADDRESS, LORE_DEEDS_ABI } from "@/lib/lore-deeds";
import { readCachedLoreMetadata } from "@/lib/lore-cache";
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
  const [loadedImageSrc, setLoadedImageSrc] = useState<string | null>(null);
  const [cacheChecked, setCacheChecked] = useState(!revealed || authoritative);
  const [cacheHit, setCacheHit] = useState(false);

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

  // Revealed metadata is already indexed in Supabase for all canonical deeds.
  // Use that tiny JSON response first so gallery cards do not need an RPC +
  // metadata gateway round trip before they can begin loading the IPFS image.
  useEffect(() => {
    if (!visible || !revealed || authoritative) {
      setCacheChecked(true);
      setCacheHit(false);
      return;
    }

    let cancelled = false;
    setCacheChecked(false);
    setCacheHit(false);
    readCachedLoreMetadata(id).then((cached) => {
      if (cancelled) return;
      if (cached?.metadata) {
        setResult(cached);
        setCacheHit(true);
      }
      setCacheChecked(true);
    });

    return () => { cancelled = true; };
  }, [id, visible, revealed, authoritative]);

  const uriRead = useReadContract({
    address: LORE_COLLECTION_ADDRESS,
    abi: LORE_DEEDS_ABI,
    functionName: "tokenURI",
    args: visible && !authoritative && cacheChecked && !cacheHit ? [id] : undefined,
    chainId: base.id,
    query: {
      enabled: visible && !authoritative && cacheChecked && !cacheHit,
      staleTime: revealed ? 15_000 : 5 * 60_000,
      gcTime: 60 * 60_000,
      refetchInterval: false,
      refetchOnWindowFocus: revealed,
      retry: 1,
    },
  });

  useEffect(() => {
    if (visible && revealed && !authoritative && cacheChecked && !cacheHit) void uriRead.refetch();
  }, [visible, revealed, id, authoritative, cacheChecked, cacheHit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setImageIndex(0);
    setProxyTried(false);
    setImageLoaded(false);
    setLoadedImageSrc(null);

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

    if (cacheHit || !visible || typeof uriRead.data !== "string") return;
    let cancelled = false;
    fetchLoreMetadataResult(uriRead.data, revealed).then((value) => {
      if (!cancelled) setResult(value);
    });
    return () => { cancelled = true; };
  }, [uriRead.data, visible, revealed, authoritative, metadataOverride, directImageOverride, cacheHit]);

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

  // Image source priority matters on mobile. Metadata now comes from the
  // Supabase index first, while artwork stays on canonical IPFS. Rotate the
  // browser through every gateway candidate before touching the Vercel resolver.
  // /api/lore/image is only the final compatibility fallback.
  const proxyImage =
    visible && result && !proxyTried
      ? `/api/lore/image?tokenId=${id.toString()}${revealed ? "&fresh=1&v=canonical-reveal-3" : ""}`
      : null;
  const exhaustedDirectCandidates = imageIndex >= images.length;
  const image = directImage || (exhaustedDirectCandidates ? proxyImage : null);
  const usingProxy = Boolean(proxyImage && image === proxyImage);

  // Preload the candidate before it ever enters the DOM. Browsers can render
  // their native broken-image glyph (and alt text) while an <img> is failing,
  // even when CSS is trying to hide it. Keeping the real <img> out of the DOM
  // until a gateway has successfully loaded guarantees a clean Lore loader.
  useEffect(() => {
    if (!image) {
      setLoadedImageSrc(null);
      setImageLoaded(false);
      return;
    }

    let cancelled = false;
    const preload = new Image();
    setLoadedImageSrc(null);
    setImageLoaded(false);

    preload.onload = () => {
      if (cancelled) return;
      setLoadedImageSrc(image);
      setImageLoaded(true);
    };

    preload.onerror = () => {
      if (cancelled) return;
      setLoadedImageSrc(null);
      setImageLoaded(false);
      if (usingProxy) setProxyTried(true);
      else setImageIndex((index) => index + 1);
    };

    preload.src = image;

    return () => {
      cancelled = true;
      preload.onload = null;
      preload.onerror = null;
    };
  }, [image, usingProxy]);
  const metadataName = result?.metadata?.name || label || `Lore Land #${id}`;
  const loading = visible && (authoritative
    ? !metadataOverride && !directImageOverride
    : (!cacheChecked || (!cacheHit && (uriRead.isLoading || (typeof uriRead.data === "string" && !result)))));

  return (
    <div ref={ref} className={`canonical-deed-art ${image ? "has-image" : "is-metadata-fallback"} ${className}`}>
      {loadedImageSrc ? (
        <img
          className="is-ready"
          src={loadedImageSrc}
          alt={metadataName}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
        />
      ) : image || loading ? (
        <div className="canonical-deed-image-loader" aria-label={`Loading Lore Land Deed #${id.toString()} artwork`} role="status">
          <div className="canonical-deed-loader-sigil" aria-hidden="true">
            <span className="canonical-deed-loader-ring ring-one" />
            <span className="canonical-deed-loader-ring ring-two" />
            <span className="canonical-deed-loader-ring ring-three" />
            <span className="canonical-deed-loader-core">◇</span>
          </div>
          <div className="canonical-deed-loader-copy">
            <strong>Calling Deed #{id.toString()}</strong>
            <small>{result ? "Finding the fastest IPFS path" : "Reading canonical metadata"}</small>
          </div>
          <div className="canonical-deed-loader-pills" aria-hidden="true">
            <span /><span /><span />
          </div>
        </div>
      ) : (
        <div className="canonical-deed-metadata-fallback">
          <span className="canonical-deed-mark">△</span>
          <strong>Canonical deed</strong>
          <small>{result?.error || "Artwork is not exposed by the current metadata."}</small>
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
