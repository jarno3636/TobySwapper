// components/ShareCallout.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type ShareCalloutProps = {
  token?: string;    // "$TOBY"
  siteUrl?: string;  // override destination URL
};

function formatCompact(n: number): string {
  // 12,345,678 -> 12.35M etc.
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.00$/, "") + "B";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.00$/, "") + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(2).replace(/\.00$/, "") + "K";
  return String(n);
}

export default function ShareCallout({ token = "$TOBY", siteUrl }: ShareCalloutProps) {
  const [burn, setBurn] = useState<string | null>(null);

  // Fetch live burned total from our API (human float string)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch("/api/burn/total", { next: { revalidate: 300 } });
        const j = await r.json();
        if (mounted && j?.ok) {
          const floatVal = parseFloat(j.totalHuman);
          const pretty =
            Number.isFinite(floatVal) ? formatCompact(floatVal) : undefined;
          setBurn(pretty ?? j.totalHuman);
        }
      } catch {
        // ignore; we’ll just omit amount
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const site =
    siteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://tobyswap.vercel.app");

  const line = useMemo(() => {
    return burn
      ? `🔥 I just helped burn ${burn} ${token}. Swap → burn → spread the lore 🐸`
      : `🔥 Swap on TobySwap (Base). 1% auto-burn to ${token}. Spread the lore 🐸`;
  }, [burn, token]);

  const textEncoded = encodeURIComponent(line);
  const urlEncoded = encodeURIComponent(site);

  // Warpcast compose (deep link w/ embeds[] so link previews your site)
  const farcasterHref = `https://warpcast.com/~/compose?text=${textEncoded}&embeds[]=${urlEncoded}`;
  // Some users prefer a plain composer URL; keep as a visible fallback:
  const farcasterWebHref = `https://warpcast.com/~/compose?text=${textEncoded}`;

  // X / Twitter intent
  const xHref = `https://twitter.com/intent/tweet?text=${textEncoded}&url=${urlEncoded}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(`${line} ${site}`);
    } catch {
      // noop
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={farcasterHref}
        target="_blank"
        rel="noopener noreferrer"
        className="pill pill-opaque hover:opacity-90 text-xs"
        title="Share on Farcaster"
      >
        Spread the Lore
      </a>
      <a
        href={xHref}
        target="_blank"
        rel="noopener noreferrer"
        className="pill pill-opaque hover:opacity-90 text-xs"
        title="Share on X"
      >
        Share to X
      </a>

      {/* Fallbacks */}
      <button
        onClick={copyToClipboard}
        className="pill pill-opaque hover:opacity-90 text-xs"
        title="Copy share text"
        type="button"
      >
        Copy Text
      </button>
      <a
        href={farcasterWebHref}
        target="_blank"
        rel="noopener noreferrer"
        className="pill pill-ghost hover:opacity-90 text-[10px]"
        title="Open Warpcast Web Composer"
      >
        Warpcast Web
      </a>

      {/* Tiny status */}
      {burn && (
        <span className="text-[10px] opacity-70 ml-1">
          live burned: {burn}
        </span>
      )}
    </div>
  );
}
