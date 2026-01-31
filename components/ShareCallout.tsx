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

/**
 * Creative message pool.
 * IMPORTANT:
 *  - Do NOT include burn count here
 *  - Do NOT include the final 🔥 line
 */
function getRandomLead(token: string) {
  const messages = [
    `Swap. Burn. Spread the lore 🐸`,
    `What better way to spread the lore than a burn?`,
    `On Base, every swap leaves a mark.`,
    `Lore travels fastest when it burns.`,
    `Small swap. Big story.`,
    `Fuel the legend. Let it burn.`,
    `The chain remembers every burn.`,
    `A ritual on Base — swap and let it burn.`,
  ];

  return messages[Math.floor(Math.random() * messages.length)];
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

  /**
   * Build the share line.
   * ALWAYS ends with:
   *   Burn Counter is at X 🔥
   */
  const line = React.useMemo(() => {
    if (!burn) {
      return `Swap on TobySwap (Base). 1% auto-burn to ${token}. Spread the lore 🐸`;
    }

    const lead = getRandomLead(token);
    return `${lead}\n\nBurn Counter is at ${burn} 🔥`;
  }, [burn, token]);

  // Always embed Mini App universal link so taps stay in Farcaster / Base App
  const embed = MINIAPP_URL && MINIAPP_URL.length > 0 ? MINIAPP_URL : site;

  // Web fallback composer URL
  const farcasterWeb = buildFarcasterComposeUrl({
    text: line,
    embeds: [embed],
  });

  const inFC = isFarcasterUA();
  const target = inFC ? "_self" : "_blank";

  const onFarcasterClick: React.MouseEventHandler<HTMLAnchorElement> = async (e) => {
    // Try native composer first (MiniKit / Farcaster SDK)
    const handled = await composeCast({
      text: line,
      embeds: [embed],
    });

    if (handled) {
      e.preventDefault();
      return;
    }
    // otherwise fall through to web composer
  };

  const xWeb = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    line
  )}&url=${encodeURIComponent(shareLanding)}`;

  if (process.env.NODE_ENV !== "production" && !MINIAPP_URL) {
    console.warn(
      "[ShareCallout] NEXT_PUBLIC_FC_MINIAPP_URL is not set; falling back to SITE_URL."
    );
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

      {burn && (
        <span className="text-[10px] opacity-70 ml-1">
          Burn Counter: {burn}
        </span>
      )}
    </div>
  );
}
