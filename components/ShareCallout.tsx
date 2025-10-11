// components/ShareCallout.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

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
      } catch {
        // ignore
      }
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

  // ---- Farcaster (Warpcast) ----
  const farcasterWeb = `https://warpcast.com/~/compose?text=${encodeURIComponent(line)}&embeds[]=${encodeURIComponent(site)}`;

  const handleFarcasterShare = async () => {
    // If running inside a Farcaster host that injects the Mini App SDK, use the official action
    try {
      if (sdk?.actions?.composeCast) {
        await sdk.actions.composeCast({ text: line, embeds: [site] });
        return;
      }
    } catch {
      // fall through to web
    }
    // Outside a Mini App: open the WEB composer in a new tab to avoid app-store bounce
    window.open(farcasterWeb, "_blank", "noopener,noreferrer");
  };

  // ---- X / Twitter ----
  const xWeb = `https://twitter.com/intent/tweet?text=${encodeURIComponent(line)}&url=${encodeURIComponent(site)}`;

  const handleXShare = () => {
    const message = `${line} ${site}`;
    const xAppUrl = `twitter://post?message=${encodeURIComponent(message)}`;

    const timer = setTimeout(() => {
      window.open(xWeb, "_blank", "noopener,noreferrer");
    }, 600);

    const win = window.open(xAppUrl, "_blank");
    setTimeout(() => {
      try {
        if (!win || win.closed) {
          clearTimeout(timer);
          window.open(xWeb, "_blank", "noopener,noreferrer");
        }
      } catch {
        // ignore
      }
    }, 150);
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
        aria-label="Share on Farcaster"
      >
        Spread the Lore
      </button>

      <button
        onClick={handleXShare}
        className="pill pill-opaque hover:opacity-90 text-xs"
        title="Share on X"
        type="button"
        aria-label="Share on X"
      >
        Share to X
      </button>

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
