// components/ShareCallout.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

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

export default function ShareCallout({ token = "$TOBY", siteUrl }: ShareCalloutProps) {
  const [burn, setBurn] = useState<string | null>(null);

  useEffect(() => {
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
    (typeof window !== "undefined" ? window.location.origin : "https://tobyswap.vercel.app");

  const line = useMemo(
    () =>
      burn
        ? `🔥 I just helped burn ${burn} ${token}. Swap → burn → spread the lore 🐸`
        : `🔥 Swap on TobySwap (Base). 1% auto-burn to ${token}. Spread the lore 🐸`,
    [burn, token]
  );

  const textEncoded = encodeURIComponent(line);
  const urlEncoded  = encodeURIComponent(site);

  // Web composer (what we want to force)
  const composerWebUrl = `https://warpcast.com/~/compose?text=${textEncoded}&embeds[]=${urlEncoded}`;

  // X / Twitter
  const xUrl = `https://twitter.com/intent/tweet?text=${textEncoded}&url=${urlEncoded}`;

  // If inside Farcaster Mini App, prefer SDK action; otherwise open web composer in a new tab.
  const handleFarcasterShare = async () => {
    try {
      // Mini App SDK is injected by Farcaster clients
      const sdk = (window as any)?.farcaster?.miniapp?.sdk || (window as any)?.sdk;
      if (sdk?.actions?.composeCast) {
        await sdk.actions.composeCast({ text: line, embeds: [site] }); // preferred path in-app
        return;
      }
    } catch {
      // fall through to web
    }
    // Force open the WEB composer (new window) to dodge universal-link -> App Store
    window.open(composerWebUrl, "_blank", "noopener,noreferrer");
  };

  const copyToClipboard = async () => {
    try { await navigator.clipboard.writeText(`${line} ${site}`); } catch {}
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={handleFarcasterShare}
        className="pill pill-opaque hover:opacity-90 text-xs"
        title="Share on Farcaster"
        type="button"
      >
        Spread the Lore
      </button>

      <a
        href={xUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="pill pill-opaque hover:opacity-90 text-xs"
        title="Share on X"
      >
        Share to X
      </a>

      <button
        onClick={copyToClipboard}
        className="pill pill-opaque hover:opacity-90 text-xs"
        title="Copy share text"
        type="button"
      >
        Copy Text
      </button>

      {burn && <span className="text-[10px] opacity-70 ml-1">live burned: {burn}</span>}
    </div>
  );
}
