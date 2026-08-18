"use client";

import { useState } from "react";
import { composeCast, buildFarcasterComposeUrl, openInMini, SITE_URL } from "@/lib/miniapps";

export default function LandShareActions({ tokenId }: { tokenId: bigint }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const path = `/land/${tokenId.toString()}`;
  const url = `${SITE_URL}${path}`;
  const text = `Lore Land #${tokenId.toString()} is taking shape in Tobyworld. 🏝🌱\n\nVisit the land:`;

  async function cast() {
    if (busy) return;
    setBusy(true);
    try {
      if (await composeCast({ text, embeds: [url] })) return;
      await openInMini(buildFarcasterComposeUrl({ text, embeds: [url] }));
    } finally { setBusy(false); }
  }

  function postX() {
    if (typeof window === "undefined") return;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener,noreferrer");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  return (
    <div className="land-share-actions">
      <button type="button" onClick={cast} disabled={busy}><span>◉</span>{busy ? "Opening…" : "Share Land"}</button>
      <button type="button" onClick={postX}><span>𝕏</span>Post to X</button>
      <button type="button" onClick={copy}><span>↗</span>{copied ? "Copied" : "Copy link"}</button>
    </div>
  );
}
