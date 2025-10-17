// components/ShareCallout.tsx
"use client";

import * as React from "react";
import {
  composeCast,
  buildFarcasterComposeUrl,
  SITE_URL,
  MINIAPP_URL,
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

  // Always prefer the Farcaster Mini App URL for embeds so taps stay in-app.
  const embed = (MINIAPP_URL && MINIAPP_URL.length > 0) ? MINIAPP_URL : site;

  // Web fallback to composer (used only if native composers aren’t available)
  const farcasterWeb = buildFarcasterComposeUrl({ text: line, embeds: [embed] });

  const onFarcasterClick = async () => {
    // Try native (MiniKit / Farcaster SDK). If it opens, we stay in-app.
    const handled = await composeCast({ text: line, embeds: [embed] });
    if (!handled) {
      // Fallback: route to web composer in the SAME tab (no target=_blank)
      window.location.assign(farcasterWeb);
    }
  };

  // X always points to your public landing (intentionally external)
  const xWeb = `https://twitter.com/intent/tweet?text=${encodeURIComponent(line)}&url=${encodeURIComponent(shareLanding)}`;

  // Dev guard: surface missing MINIAPP_URL in console (no UX impact)
  if (process.env.NODE_ENV !== "production" && !MINIAPP_URL) {
    // eslint-disable-next-line no-console
    console.warn("[ShareCallout] NEXT_PUBLIC_FC_MINIAPP_URL is not set; falling back to SITE_URL.");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onFarcasterClick}
        className="pill pill-opaque hover:opacity-90 text-xs flex items-center gap-1"
        title="Share on Farcaster"
        aria-label="Share on Farcaster"
      >
        <span className="text-[#8A63D2]">🌀</span>
        Spread the Lore
      </button>

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
