"use client";

import * as React from "react";
import { composeCast } from "@/lib/miniapp";

type ShareCalloutProps = {
  token?: string;   // "$TOBY"
  siteUrl?: string; // override destination URL
};

function formatCompact(n: number): string {
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
    siteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    runtimeOrigin("https://tobyswap.vercel.app"); // must be absolute for embeds[]

  const line = React.useMemo(
    () =>
      burn
        ? `🔥 I just helped burn ${burn} ${token}. Swap → burn → spread the lore 🐸`
        : `🔥 Swap on TobySwap (Base). 1% auto-burn to ${token}. Spread the lore 🐸`,
    [burn, token]
  );

  // ---- Farcaster (anchor default; SDK intercepts in-app) ----
  const farcasterWeb = `https://warpcast.com/~/compose?text=${encodeURIComponent(line)}&embeds[]=${encodeURIComponent(site)}`;

  const onFarcasterClick: React.MouseEventHandler<HTMLAnchorElement> = async (e) => {
    // Try SDK compose; if it works, keep user in-app and cancel link.
    const ok = await composeCast({ text: line, embeds: [site] });
    if (ok) e.preventDefault();
    // If not ok, let the anchor open Warpcast web composer (works on web/dapp without popup blockers).
  };

  // ---- X / Twitter (anchor avoids popup-blockers) ----
  const xWeb = `https://twitter.com/intent/tweet?text=${encodeURIComponent(line)}&url=${encodeURIComponent(site)}`;

  const copyToClipboard = async () => {
    try { await navigator.clipboard.writeText(`${line} ${site}`); } catch {}
  };

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

      <button
        onClick={copyToClipboard}
        className="pill pill-opaque hover:opacity-90 text-xs"
        title="Copy share text"
        type="button"
        aria-label="Copy share text"
      >
        Copy Text
      </button>

      {burn && <span className="text-[10px] opacity-70 ml-1">live burned: {burn}</span>}
    </div>
  );
}
