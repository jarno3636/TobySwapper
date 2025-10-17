import { NextResponse } from "next/server";
import { getSiteUrl, getMiniUrl } from "@/lib/fc";

function compact(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.00$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.00$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2).replace(/\.00$/, "") + "K";
  return String(n);
}

async function liveLine(site: string, token = "$TOBY") {
  try {
    const res = await fetch(`${site}/api/burn/total`, { cache: "no-store" });
    const j = await res.json();
    if (j?.ok && j.totalHuman) {
      const n = Number.parseFloat(j.totalHuman);
      const pretty = Number.isFinite(n) ? compact(n) : j.totalHuman;
      return `🔥 I just helped burn ${pretty} ${token}. Swap → burn → spread the lore 🐸`;
    }
  } catch {}
  return `🔥 Swap on TobySwap (Base). 1% auto-burn to ${token}. Spread the lore 🐸`;
}

export async function POST(req: Request) {
  const site = getSiteUrl();
  const mini = getMiniUrl();

  let body: any = {};
  try { body = await req.json(); } catch {}
  const idx: number = body?.untrustedData?.buttonIndex ?? 1;

  const line = await liveLine(site, "$TOBY");
  const encodedText = encodeURIComponent(line);
  const encodedMini = encodeURIComponent(mini);
  const encodedSite = encodeURIComponent(site);

  // For Farcaster composer, EMBED THE MINI APP URL
  const farcasterHref = `https://warpcast.com/~/compose?text=${encodedText}&embeds[]=${encodedMini}`;
  const xHref         = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedSite}`;

  if (idx === 1) {
    // “Spread the Lore” page — opens composer *inside* Farcaster
    return NextResponse.json(
      {
        version: "next",
        title: "Spread the Lore 🌀",
        image: `${site}/api/frame/image`,
        imageAlt: "Share on Farcaster",
        buttons: [
          { label: "Open Composer", action: { type: "launch_url", url: farcasterHref } },
          { label: "⬅️ Back",      action: "post" },
        ],
        postUrl: `${site}/api/frame/post`,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (idx === 2) {
    return NextResponse.json(
      {
        version: "next",
        title: "Share to X 𝕏",
        image: `${site}/api/frame/image`,
        imageAlt: "Share on X / Twitter",
        buttons: [
          { label: "Open Composer", action: { type: "launch_url", url: xHref } },
          { label: "⬅️ Back",      action: "post" },
        ],
        postUrl: `${site}/api/frame/post`,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (idx === 4) {
    // “More 🔥” — keep both primary actions inside Farcaster
    return NextResponse.json(
      {
        version: "next",
        title: "🔥 Burn More, Swap More",
        image: `${site}/api/frame/image`,
        imageAlt: "Keep the flames going — swap & burn to $TOBY.",
        buttons: [
          // IMPORTANT: use Mini App URL so it opens in-app
          { label: "Swap Now",        action: { type: "launch_url", url: mini } },
          { label: "Spread the Lore", action: { type: "launch_url", url: farcasterHref } },
          { label: "⬅️ Back",         action: "post" },
        ],
        postUrl: `${site}/api/frame/post`,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Default page
  return NextResponse.json(
    {
      version: "next",
      title: "Toby Swapper 🔥",
      image: `${site}/api/frame/image`,
      imageAlt: "Swap. Burn. Spread the Lore.",
      buttons: [
        { label: "Spread the Lore",   action: "post" },
        { label: "Share to X",        action: "post" },
        // IMPORTANT: open the Mini App in Farcaster, not the public site
        { label: "Open Toby Swapper", action: { type: "launch_url", url: mini } },
        { label: "More 🔥",           action: "post" },
      ],
      postUrl: `${site}/api/frame/post`,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
