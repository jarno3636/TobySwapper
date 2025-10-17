// components/ShareCallout.tsx
"use client";

import * as React from "react";
import {
  composeCast,
  buildFarcasterComposeUrl,
  SITE_URL,
  MINIAPP_URL,
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

  // Always embed the Mini App universal link so taps stay in Farcaster
  const embed = MINIAPP_URL && MINIAPP_URL.length > 0 ? MINIAPP_URL : site;

  // Web fallback composer URL (works anywhere)
  const farcasterWeb = buildFarcasterComposeUrl({ text: line, embeds: [embed] });

  const inFC = isFarcasterUA();
  const target = inFC ? "_self" : "_blank"; // stay in-app on Farcaster, open new tab elsewhere

  const onFarcasterClick: React.MouseEventHandler<HTMLAnchorElement> = async (e) => {
    // Try native composer first (MiniKit / Farcaster SDK)
    const handled = await composeCast({ text: line, embeds: [embed] });
    if (handled) {
      e.preventDefault(); // native composer opened; don't navigate
      return;
    }
    // Not handled -> allow normal anchor navigation to farcasterWeb (works in dapp browsers)
    // (No preventDefault here)
  };

  const xWeb = `https://twitter.com/intent/tweet?text=${encodeURIComponent(line)}&url=${encodeURIComponent(shareLanding)}`;

  if (process.env.NODE_ENV !== "production" && !MINIAPP_URL) {
    console.warn("[ShareCallout] NEXT_PUBLIC_FC_MINIAPP_URL is not set; falling back to SITE_URL.");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={farcasterWeb}
        target={target}
        rel={inFC ? undefined : "noopener noreferrer"}
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
