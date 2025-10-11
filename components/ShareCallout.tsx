// components/ShareCallout.tsx
"use client";

import { useMemo } from "react";

type ShareCalloutProps = {
  amount?: string;   // e.g., "123,456"
  token?: string;    // e.g., "$TOBY"
  siteUrl?: string;  // overrides default site URL if provided
};

export default function ShareCallout({ amount, token = "$TOBY", siteUrl }: ShareCalloutProps) {
  const site =
    siteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://tobyswap.vercel.app");

  // Short, shareable copy
  const line = useMemo(() => {
    if (amount) {
      return `🔥 I just helped burn ${amount} ${token}. Swap → burn → spread the lore 🐸`;
    }
    return `🔥 Swap on TobySwap (Base). 1% auto-burn to ${token}. Spread the lore 🐸`;
  }, [amount, token]);

  const textEncoded = encodeURIComponent(line);
  const urlEncoded = encodeURIComponent(site);

  // Warpcast compose (adds card preview via embeds[])
  const farcasterHref = `https://warpcast.com/~/compose?text=${textEncoded}&embeds[]=${urlEncoded}`;

  // X / Twitter intent
  const xHref = `https://twitter.com/intent/tweet?text=${textEncoded}&url=${urlEncoded}`;

  return (
    <div className="flex flex-wrap gap-2">
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
    </div>
  );
}
