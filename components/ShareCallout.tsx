// components/ShareCallout.tsx
"use client";

import * as React from "react";
import {
  composeCast,
  buildFarcasterComposeUrl,
  MINIAPP_URL,
  isFarcasterUA,
  isBaseAppUA,
} from "@/lib/miniapp";

type ShareCalloutProps = {
  token?: string;
  siteUrl?: string;
};

function formatCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.00$/, "") + "B";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.00$/, "") + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(2).replace(/\.00$/, "") + "K";
  return String(n);
}

function runtimeOrigin(fallback: string) {
  try {
    if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  } catch {}
  return fallback;
}

export default function ShareCallout({ token = "$TOBY", siteUrl }: ShareCalloutProps) {
  const [burn, setBurn] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch(`/api/burn/total?ts=${Date.now()}`, { cache: "no-store" });
        const j = await r.json();
        if (mounted && j?.ok) {
          const n = parseFloat(j.totalHuman);
          setBurn(Number.isFinite(n) ? formatCompact(n) : j.totalHuman);
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  const site =
    siteUrl || process.env.NEXT_PUBLIC_SITE_URL || runtimeOrigin("https://tobyswap.vercel.app");

  // Use your Mini App link for Farcaster embeds (opens in-app)
  const mini = MINIAPP_URL || process.env.NEXT_PUBLIC_FC_MINIAPP_URL || site;

  const line = React.useMemo(
    () =>
      burn
        ? `🔥 I just helped burn ${burn} ${token}. Swap → burn → spread the lore 🐸`
        : `🔥 Swap on TobySwap (Base). 1% auto-burn to ${token}. Spread the lore 🐸`,
    [burn, token]
  );

  const farcasterWeb = buildFarcasterComposeUrl({ text: line, embeds: [mini] });
  const xWeb = `https://twitter.com/intent/tweet?text=${encodeURIComponent(line)}&url=${encodeURIComponent(site)}`;

  const onFarcasterClick: React.MouseEventHandler<HTMLAnchorElement> = async (e) => {
    // 1) If in Warpcast, use SDK & prevent default.
    if (isFarcasterUA()) {
      const ok = await composeCast({ text: line, embeds: [mini] });
      if (ok) {
        e.preventDefault();
        return;
      }
    }
    // 2) If inside Base app webview, force same-tab to avoid app-store bounce.
    if (isBaseAppUA()) {
      e.preventDefault();
      window.location.href = farcasterWeb;
    }
    // 3) Else let the anchor open normally (new tab).
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={farcasterWeb}
        target={isBaseAppUA() ? "_self" : "_blank"}
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
