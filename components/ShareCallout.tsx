// components/ShareCallout.tsx
"use client";

import * as React from "react";
import {
  composeCast,
  buildFarcasterComposeUrl,
  SITE_URL,
  MINIAPP_URL,
  isFarcasterUA,
  isBaseAppUA,
  openInBase,
} from "@/lib/miniapp";
import { useBurnTotal } from "@/lib/burn";   // ✅ NEW

type ShareCalloutProps = {
  token?: string;   // "$TOBY"
  siteUrl?: string; // override destination URL for X
};

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.00$/, "") + "B";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.00$/, "") + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(2).replace(/\.00$/, "") + "K";
  return String(n);
}

export default function ShareCallout({ token = "$TOBY", siteUrl }: ShareCalloutProps) {
  // ✅ shared, reactive data source
  const { data: burnRaw } = useBurnTotal();

  // normalize/pretty-print
  const burn = React.useMemo(() => {
    if (!burnRaw) return null;
    const n = Number.parseFloat(String(burnRaw).replace(/,/g, ""));
    return Number.isFinite(n) ? formatCompact(n) : burnRaw;
  }, [burnRaw]);

  // Absolute URLs
  const site = siteUrl || SITE_URL;
  const shareLanding = `${SITE_URL}/share`; // avoids X loops

  const line = React.useMemo(
    () =>
      burn
        ? `🔥 I just helped burn ${burn} ${token}. Swap → burn → spread the lore 🐸`
        : `🔥 Swap on TobySwap (Base). 1% auto-burn to ${token}. Spread the lore 🐸`,
    [burn, token]
  );

  // Embed: use MINIAPP_URL only inside Warpcast; use normal site elsewhere
  const embedForFC = isFarcasterUA() && MINIAPP_URL ? MINIAPP_URL : site;

  // Farcaster web composer
  const farcasterWeb = buildFarcasterComposeUrl({ text: line, embeds: [embedForFC] });

  const onFarcasterClick: React.MouseEventHandler<HTMLAnchorElement> = async (e) => {
    // Base app: try in-app
    if (isBaseAppUA()) {
      const handled = await openInBase(farcasterWeb);
      if (handled) {
        e.preventDefault();
        return;
      }
    }
    // Warpcast Mini App: in-app compose
    const ok = await composeCast({ text: line, embeds: [embedForFC] });
    if (ok) {
      e.preventDefault();
      return;
    }
    // Else: let the anchor open web composer
  };

  const xWeb = `https://twitter.com/intent/tweet?text=${encodeURIComponent(line)}&url=${encodeURIComponent(shareLanding)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={farcasterWeb}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onFarcasterClick}
        className="pill pill-opaque hover:opacity-90 text-xs flex items-center gap-1"
        title="Share on Farcaster"
        aria-label="Share on Farcaster"
      >
        <span className="text-[#8A63D2]">🌀</span>
        Spread the Lore
      </a>

      <a
        href={xWeb}
        target="_blank"
        rel="noopener noreferrer"
        className="pill pill-opaque hover:opacity-90 text-xs flex items-center gap-1"
        title="Share on X"
        aria-label="Share on X"
      >
        <span>𝕏</span>
        Share to X
      </a>

      {burn && <span className="text-[10px] opacity-70 ml-1">live burned: {burn}</span>}
    </div>
  );
}
