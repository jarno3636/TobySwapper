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
          const floatVal = parseFloat(j.totalHuman);
          const pretty = Number.isFinite(floatVal) ? formatCompact(floatVal) : undefined;
          setBurn(pretty ?? j.totalHuman);
        }
      } catch {}
    })();
    return () => { mounted = false; };
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

  // Use the *web* composer as primary to avoid app-store redirects
  const farcasterWeb = `https://warpcast.com/~/compose?text=${textEncoded}&embeds[]=${urlEncoded}`;
  const xHref = `https://twitter.com/intent/tweet?text=${textEncoded}&url=${urlEncoded}`;

  const onFarcasterClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    // For some mobile UAs, even the web composer may try to bounce to the store.
    // If that happens, open the web composer again in a separate tab shortly after.
    // This gives users a visible, working web composer even without the app.
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return; // desktop is fine

    // open once via default <a>, then force-open a second time after a short delay
    setTimeout(() => {
      // if the browser navigated away (store), give them a clean web tab too
      window.open(farcasterWeb, "_blank", "noopener,noreferrer");
    }, 700);
  };

  const copyToClipboard = async () => {
    try { await navigator.clipboard.writeText(`${line} ${site}`); } catch {}
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={farcasterWeb}
        onClick={onFarcasterClick}
        target="_blank"
        rel="noopener noreferrer"
        className="pill pill-opaque hover:opacity-90 text-xs"
        title="Share on Farcaster (web composer)"
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
