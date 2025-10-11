// app/api/frame/post/route.ts
import { NextResponse } from "next/server";

/**
 * Frame POST handler (Farcaster vNext).
 *
 * Initial frame buttons (1-based):
 *  1) Spread the Lore (Warpcast compose)
 *  2) Share to X (Twitter intent)
 *  3) Open Toby Swapper (launch_url)
 *  4) More 🔥 (post -> follow-up frame)
 *
 * Follow-up frame buttons:
 *  1) Swap Now (launch_url)
 *  2) Spread the Lore (Warpcast compose)
 *  3) ⬅️ Back (post -> initial)
 */
export async function POST(req: Request) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";

  // Compose text (keep it short & punchy)
  const line = `🔥 Swap on TobySwap (Base). 1% auto-burn to $TOBY. Spread the lore 🐸`;
  const encodedText = encodeURIComponent(line);
  const encodedSite = encodeURIComponent(site);

  // Warpcast compose with embeds[] so the card previews your site
  const farcasterHref =
    `https://warpcast.com/~/compose?text=${encodedText}&embeds[]=${encodedSite}`;

  // X / Twitter share intent
  const xHref =
    `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedSite}`;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // no-op; body stays {}
  }

  const idx: number = body?.untrustedData?.buttonIndex ?? 1;

  // FOLLOW-UP FRAME when user taps "More 🔥" on initial (button #4)
  if (idx === 4) {
    return NextResponse.json(
      {
        version: "next",
        title: "🔥 Burn More, Swap More",
        image: `${site}/api/frame/image`,
        imageAlt: "Keep the flames going — swap & burn to $TOBY.",
        buttons: [
          { label: "Swap Now",        action: { type: "launch_url", url: site } },
          { label: "Spread the Lore", action: { type: "launch_url", url: farcasterHref } },
          { label: "⬅️ Back",         action: "post" },
        ],
        postUrl: `${site}/api/frame/post`,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // INITIAL FRAME
  return NextResponse.json(
    {
      version: "next",
      title: "Toby Swapper 🔥",
      image: `${site}/api/frame/image`,
      imageAlt: "Swap. Burn. Spread the Lore.",
      buttons: [
        { label: "Spread the Lore",   action: { type: "launch_url", url: farcasterHref } },
        { label: "Share to X",        action: { type: "launch_url", url: xHref } },
        { label: "Open Toby Swapper", action: { type: "launch_url", url: site } },
        { label: "More 🔥",           action: "post" },
      ],
      postUrl: `${site}/api/frame/post`,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
