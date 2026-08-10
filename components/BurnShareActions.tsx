"use client";

import { useMemo, useState } from "react";
import { composeCast, buildFarcasterComposeUrl, openInMini, SITE_URL } from "@/lib/miniapps";
import { useBurnTotal } from "@/lib/burn";

function compactBurn(raw?: string | null) {
  if (!raw) return "";
  const n = Number.parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) return raw;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2).replace(/\.00$/, "")}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2).replace(/\.00$/, "")}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(2).replace(/\.00$/, "")}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function BurnShareActions() {
  const { data } = useBurnTotal();
  const [sharing, setSharing] = useState<"fc" | "x" | null>(null);
  const burn = useMemo(() => compactBurn(data), [data]);
  const burnersUrl = `${SITE_URL.replace(/\/$/, "")}/burners`;
  const text = burn
    ? `🔥 ${burn} TOBY burned through TobySwap.\n\nThe pond keeps score — climb the Burner ranks.`
    : `🔥 The pond keeps score. Swap through TobySwap and climb the onchain Burner ranks.`;

  const shareFarcaster = async () => {
    setSharing("fc");
    try {
      if (await composeCast({ text, embeds: [burnersUrl] })) return;
      const url = buildFarcasterComposeUrl({ text, embeds: [burnersUrl] });
      if (!(await openInMini(url))) window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setSharing(null);
    }
  };

  const shareX = async () => {
    setSharing("x");
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(burnersUrl)}`;
    try {
      if (!(await openInMini(url))) window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      window.setTimeout(() => setSharing(null), 300);
    }
  };

  return (
    <div className="burn-share-cta" aria-label="Share the Pond Burners leaderboard">
      <div className="burn-share-copy">
        <span>SPREAD THE FLAME</span>
        <strong>Show the pond your rank.</strong>
        <small>{burn ? `${burn} TOBY burned and counting.` : "Burn totals update onchain."}</small>
      </div>
      <div className="burn-share-buttons">
        <button className="metal-button burn-share-button burn-share-fc" type="button" onClick={shareFarcaster} disabled={sharing !== null}>
          <span className="burn-share-icon">◌</span><strong>{sharing === "fc" ? "Opening…" : "Cast rank"}</strong>
        </button>
        <button className="metal-button burn-share-button burn-share-x" type="button" onClick={shareX} disabled={sharing !== null}>
          <span className="burn-share-icon">𝕏</span><strong>{sharing === "x" ? "Opening…" : "Post to X"}</strong>
        </button>
      </div>
    </div>
  );
}
