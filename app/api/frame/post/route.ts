import { NextResponse } from "next/server";

/**
 * vNext Frame POST handler.
 * Branches by untrustedData.buttonIndex (1-based).
 *
 * Flow:
 *  - From initial frame: button 2 ("More 🔥") -> returns a new frame
 *  - In follow-up: [1] Swap Now (launch_url), [2] Back (post -> initial)
 */
export async function POST(req: Request) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // ignore; body stays {}
  }

  const idx: number = body?.untrustedData?.buttonIndex ?? 1;

  // If user tapped "More 🔥" on the initial frame (button #2)
  if (idx === 2) {
    return NextResponse.json(
      {
        version: "next",
        title: "🔥 Burn More, Swap More",
        image: `${site}/api/frame/image`, // reuse OG for speed; you can swap to a second image if you have one
        imageAlt: "Keep the flames going — swap & burn to $TOBY.",
        buttons: [
          { label: "Swap Now", action: { type: "launch_url", url: site } },
          { label: "⬅️ Back", action: "post" },
        ],
        postUrl: `${site}/api/frame/post`,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Any other button (including "⬅️ Back") returns the initial frame payload shape
  return NextResponse.json(
    {
      version: "next",
      title: "Toby Swapper 🔥",
      image: `${site}/api/frame/image`,
      imageAlt: "Swap. Burn. Spread the Lore.",
      buttons: [
        { label: "Open Toby Swapper", action: { type: "launch_url", url: site } },
        { label: "More 🔥", action: "post" },
      ],
      postUrl: `${site}/api/frame/post`,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
