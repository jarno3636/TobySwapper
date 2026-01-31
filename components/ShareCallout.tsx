// components/ShareCallout.tsx
"use client";

import * as React from "react";
import {
  composeCast,
  buildFarcasterComposeUrl,
  SITE_URL,
  MINIAPP_URL,
} from "@/lib/miniapps";
import { useBurnTotal } from "@/lib/burn";

type ShareCalloutProps = {
  token?: string;
  siteUrl?: string;
};

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.00$/, "") + "B";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.00$/, "") + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(2).replace(/\.00$/, "") + "K";
  return String(n);
}

function getRandomLead() {
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
  const embed = MINIAPP_URL && MINIAPP_URL.length > 0 ? MINIAPP_URL : site;

  const buildLine = React.useCallback(() => {
    if (!burn) {
      return `Swap on TobySwap (Base). 1% auto-burn to ${token}. Spread the lore 🐸`;
    }
    return `${getRandomLead()}\n\nBurn Counter is at ${burn} 🔥`;
  }, [burn, token]);

  const onFarcasterClick = async () => {
    const text = buildLine();

    // 1️⃣ Try native Mini App / SDK compose
    try {
      const handled = await composeCast({
        text,
        embeds: [embed],
      });

      if (handled) return;
    } catch {
      // swallow and fall through
    }

    // 2️⃣ ALWAYS fallback to web composer
    const url = buildFarcasterComposeUrl({
      text,
      embeds: [embed],
    });

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const xWeb = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    buildLine()
  )}&url=${encodeURIComponent(`${SITE_URL}/share`)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* FARCASTER / BASE APP SHARE */}
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

      {/* X SHARE */}
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
