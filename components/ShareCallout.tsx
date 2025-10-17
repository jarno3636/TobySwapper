"use client";

import * as React from "react";
import {
  composeCast,
  buildFarcasterComposeUrl,
  SITE_URL,
  MINIAPP_URL,          // make sure this is your Farcaster Mini App URL
  isFarcasterUA,
} from "@/lib/miniapp";
import { useBurnTotal } from "@/lib/burn";

type ShareCalloutProps = {
  token?: string;   // "$TOBY"
  siteUrl?: string; // optional override for public site (X only)
};

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.00$/, "") + "B";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.00$/, "") + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(2).replace(/\.00$/, "") + "K";
  return String(n);
}

export default function ShareCallout({ token = "$TOBY", siteUrl }: ShareCalloutProps) {
  const { data: burnRaw } = useBurnTotal();

  const burn = React.useMemo(() => {
    if (!burnRaw) return null;
    const n = Number.parseFloat(String(burnRaw).replace(/,/g, ""));
    return Number.isFinite(n) ? formatCompact(n) : burnRaw;
  }, [burnRaw]);

  const site = siteUrl || SITE_URL;
  const shareLanding = `${SITE_URL}/share`;

  const line = React.useMemo(
    () =>
      burn
        ? `🔥 I just helped burn ${burn} ${token}. Swap → burn → spread the lore 🐸`
        : `🔥 Swap on TobySwap (Base). 1% auto-burn to ${token}. Spread the lore 🐸`,
    [burn, token]
  );

  // Prefer the Farcaster Mini App URL for embeds so the cast opens *inside* Farcaster.
  // Outside Farcaster, public site is fine.
  const embedForFC = (MINIAPP_URL && MINIAPP_URL.length > 0) ? MINIAPP_URL : site;

  // Web fallback to composer (used only if native composers aren’t available)
  const farcasterWeb = buildFarcasterComposeUrl({ text: line, embeds: [embedForFC] });

  const onFarcasterClick: React.MouseEventHandler<HTMLAnchorElement> = async (e) => {
    // Try native (MiniKit / Farcaster SDK). If it opens, stay in-app.
    const handled = await composeCast({ text: line, embeds: [embedForFC] });
    if (handled) {
      e.preventDefault();
      return;
    }
    // Otherwise allow navigation to web composer
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
