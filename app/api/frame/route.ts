import { NextResponse } from "next/server";
import { getSiteUrl, getMiniUrl } from "@/lib/fc";

export async function GET() {
  const site = getSiteUrl();
  const mini = getMiniUrl();

  return NextResponse.json(
    {
      version: "next",
      title: "Toby Swapper 🐸",
      image: `${site}/api/frame/image`,
      imageAlt: "Swap on Base with 1% auto-burn to $TOBY.",
      buttons: [
        // IMPORTANT: open inside Farcaster
        { label: "Open Toby Swapper", action: { type: "launch_url", url: mini } },
        { label: "More 🔥",            action: "post" },
      ],
      postUrl: `${site}/api/frame/post`,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
