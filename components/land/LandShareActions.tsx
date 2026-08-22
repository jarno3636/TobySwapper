"use client";

import { useEffect, useMemo, useState } from "react";
import type { LoreMetadata } from "@/lib/lore-metadata";
import { extractLoreTraits } from "@/lib/lore-metadata-shared";
import { readPublicLandProfile, type LandCommunityProfile } from "@/lib/land-profile";
import { composeCast, buildFarcasterComposeUrl, openInMini, SITE_URL } from "@/lib/miniapps";

export default function LandShareActions({ tokenId, metadata }: { tokenId: bigint; metadata?: LoreMetadata | null }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [profile, setProfile] = useState<LandCommunityProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    readPublicLandProfile(tokenId).then((next) => {
      if (!cancelled) setProfile(next);
    });
    return () => { cancelled = true; };
  }, [tokenId]);

  const path = `/land/${tokenId.toString()}`;
  const url = `${SITE_URL}${path}`;
  const shareImage = `${SITE_URL}/api/og/land/${tokenId.toString()}`;

  const signs = useMemo(() => {
    if (!metadata) return [] as string[];
    const preferred = ["Land", "Core", "Relic", "Keeper", "Background"];
    const traits = extractLoreTraits(metadata)
      .map((trait) => ({ type: String(trait.trait_type || "").trim(), value: String(trait.value || "").trim() }))
      .filter((trait) => trait.type && trait.value);

    return traits
      .sort((a, b) => {
        const ai = preferred.indexOf(a.type);
        const bi = preferred.indexOf(b.type);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
      .slice(0, 3)
      .map((trait) => trait.value);
  }, [metadata]);

  const text = useMemo(() => {
    const place = profile?.communityName || `Lore Land #${tokenId.toString()}`;
    const signLine = signs.length ? `\n${signs.join(" · ")}` : "";
    return `${place} · Lore Land #${tokenId.toString()}${signLine}\n\nExplore this place in Tobyworld:`;
  }, [profile?.communityName, signs, tokenId]);

  async function cast() {
    if (busy) return;
    setBusy(true);
    try {
      if (await composeCast({ text, embeds: [url, shareImage] })) return;
      await openInMini(buildFarcasterComposeUrl({ text, embeds: [url, shareImage] }));
    } finally {
      setBusy(false);
    }
  }

  function postX() {
    if (typeof window === "undefined") return;
    window.open(
      `https://x.com/intent/post?text=${encodeURIComponent(`${text}\n${url}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  return (
    <div className="land-share-actions land-share-actions-v3">
      <button type="button" onClick={cast} disabled={busy}>
        <span>◉</span>{busy ? "Opening…" : "Share Land"}
      </button>
      <button type="button" onClick={postX}><span>𝕏</span>Post to X</button>
      <button type="button" onClick={copy}><span>↗</span>{copied ? "Copied" : "Copy link"}</button>
      <a className="land-share-preview" href={shareImage} target="_blank" rel="noreferrer"><span>▣</span>Share card</a>
    </div>
  );
}
