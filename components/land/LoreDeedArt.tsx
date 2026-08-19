"use client";

import { useEffect, useRef, useState } from "react";
import { base } from "viem/chains";
import { useReadContract } from "wagmi";
import { LORE_COLLECTION_ADDRESS, LORE_DEEDS_ABI } from "@/lib/lore-deeds";
import { fetchLoreMetadata, loreImage, type LoreMetadata } from "@/lib/lore-metadata";

export default function LoreDeedArt({
  tokenId,
  label,
  className = "",
  eager = false,
}: {
  tokenId: string | bigint;
  label?: string;
  className?: string;
  eager?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(eager);
  const [metadata, setMetadata] = useState<LoreMetadata | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

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
    fetchLoreMetadata(uriRead.data).then((value) => {
      if (!cancelled) {
        setMetadata(value);
        setImageFailed(false);
      }
    });
    return () => { cancelled = true; };
  }, [uriRead.data, visible]);

  const image = imageFailed ? null : loreImage(metadata);

  return (
    <div ref={ref} className={`canonical-deed-art ${image ? "has-image" : "is-fallback"} ${className}`}>
      {image ? (
        <img
          src={image}
          alt={metadata?.name || label || `Lore Land #${id}`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <>
          <span className="canonical-deed-art-sky" />
          <span className="canonical-deed-art-moon" />
          <span className="canonical-deed-art-island" />
          <span className="canonical-deed-art-rune">△</span>
        </>
      )}
      <span className="canonical-deed-art-id">#{id.toString()}</span>
    </div>
  );
}
