// app/page.tsx
"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import Footer from "@/components/Footer";

// Client-only heavy components
const SwapForm = dynamic(() => import("@/components/SwapForm"), { ssr: false });
const InfoCarousel = dynamic(() => import("@/components/InfoCarousel"), {
  ssr: false,
  loading: () => (
    <div className="glass rounded-3xl p-5 shadow-soft w-full" style={{ maxWidth: 520 }}>
      <div className="h-5 w-44 bg-white/10 rounded mb-4" />
      <div className="flex gap-4">
        <div className="w-[16%] h-24 bg-white/10 rounded-2xl" />
        <div className="flex-1 h-40 bg-white/10 rounded-3xl" />
        <div className="w-[16%] h-24 bg-white/10 rounded-2xl" />
      </div>
      <div className="mt-3 h-2.5 w-24 bg-white/10 rounded-full" />
    </div>
  ),
});
const TokensBurned = dynamic(() => import("@/components/TokensBurned"), {
  ssr: false,
  loading: () => (
    <div className="glass rounded-3xl p-6 shadow-soft mt-6 animate-pulse">
      <div className="h-5 w-40 bg-white/10 rounded mb-4" />
      <div className="h-10 w-64 bg-white/10 rounded mb-3" />
      <div className="h-3 w-full bg-white/10 rounded" />
    </div>
  ),
});

/** Share callout: Farcaster + X with live burn and robust app/web handling */
import { useEffect, useMemo, useState } from "react";

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.00$/, "") + "B";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.00$/, "") + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(2).replace(/\.00$/, "") + "K";
  return String(n);
}

function ShareCallout({
  token = "$TOBY",
  siteUrl,
}: {
  token?: string;
  siteUrl?: string;
}) {
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

  // --- Farcaster (Warpcast) ---
  const composerWebUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(line)}&embeds[]=${encodeURIComponent(site)}`;

  const handleFarcasterShare = async () => {
    try {
      // If running inside a Farcaster Mini App host, use the official SDK if present
      const fcSdk =
        (window as any)?.farcaster?.miniapp?.sdk ||
        (window as any)?.sdk ||
        undefined;

      if (fcSdk?.actions?.composeCast) {
        await fcSdk.actions.composeCast({ text: line, embeds: [site] });
        return;
      }
    } catch {
      // fall through to web
    }
    // Outside a Mini App: open web composer in a new tab to avoid app-store loops
    window.open(composerWebUrl, "_blank", "noopener,noreferrer");
  };

  // --- X / Twitter ---
  const xWebUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(line)}&url=${encodeURIComponent(site)}`;

  const handleXShare = () => {
    const message = `${line} ${site}`;
    const xAppUrl = `twitter://post?message=${encodeURIComponent(message)}`;

    // Try native app; fallback to web after a short delay
    const fallback = setTimeout(() => {
      window.open(xWebUrl, "_blank", "noopener,noreferrer");
    }, 600);

    const win = window.open(xAppUrl, "_blank");
    setTimeout(() => {
      try {
        if (!win || win.closed) {
          clearTimeout(fallback);
          window.open(xWebUrl, "_blank", "noopener,noreferrer");
        }
      } catch {
        // ignore
      }
    }, 150);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={handleFarcasterShare}
        className="pill pill-opaque hover:opacity-90 text-xs flex items-center gap-1"
        title="Share on Farcaster"
        type="button"
      >
        <span className="text-[#8A63D2]">🌀</span>
        Spread the Lore
      </button>

      <button
        onClick={handleXShare}
        className="pill pill-opaque hover:opacity-90 text-xs flex items-center gap-1"
        title="Share on X"
        type="button"
      >
        <span>𝕏</span>
        Share to X
      </button>
    </div>
  );
}

// Micro blur placeholder
const BLUR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4BwQACgAB3y2e1iAAAAAASUVORK5CYII=";

export default function Page() {
  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          {/* LEFT */}
          <div className="flex flex-col items-center md:items-start">
            <div
              className="glass rounded-3xl overflow-hidden mb-6 relative w-[70%] max-w-[360px] sm:max-w-[420px] md:max-w-[480px]
              animate-[slideUpFade_0.8s_ease-out]"
              style={{ aspectRatio: "4 / 3" }}
            >
              <Image
                src="/toby-hero.PNG"
                alt="Toby hero"
                fill
                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 50vw, 480px"
                className="object-contain"
                priority
                placeholder="blur"
                blurDataURL={BLUR}
                quality={70}
              />
            </div>

            <h1 className="text-3xl font-bold mb-4 text-center md:text-left">
              Swap. Burn. Spread the Lore.
            </h1>

            <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-6 w-full">
              <span className="pill bg-[var(--glass)] text-sm">1% auto-burn to $TOBY 🔥</span>
              <span className="pill bg-[var(--glass)] text-sm">Swap ETH, Patience, Taboshi</span>
              <span className="pill bg-[var(--glass)] text-sm">Fuel the meme · Join the lore 🐸</span>
            </div>

            <div className="w-full max-w-full sm:max-w-[520px] content-visible">
              <SwapForm />
              <div className="mt-3 flex gap-2 items-center">
                <ShareCallout token="$TOBY" />
              </div>
              <TokensBurned />
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex w-full justify-center">
            <div className="w-full" style={{ maxWidth: 520 }}>
              <InfoCarousel />
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
