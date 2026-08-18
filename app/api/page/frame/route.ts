import { NextResponse } from "next/server";
import { getSiteUrl, getMiniUrl } from "@/lib/fc";

export async function GET() {
  const site = getSiteUrl();
  const mini = getMiniUrl();

  return NextResponse.json(
    {
      version: "next",
      title: "Toby Swapper 🐸",
      image: `${site}/og/tobyswap-card-1200x630.png`,
      imageAlt: "Swap on Base with 1% auto-burn to $TOBY.",
      // IMPORTANT: use the Mini App URL so it opens inside Farcaster
      buttons: [
        { label: "Enter Toby Swapper", action: { type: "launch_url", url: mini } },
        { label: "More 🔥",            action: "post" },
      ],
      postUrl: `${site}/api/frame/post`,
    },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
  );
}
