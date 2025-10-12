import { NextResponse } from "next/server";

export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";

  return NextResponse.json(
    {
      version: "next",
      title: "Toby Swapper 🐸",
      image: `${site}/api/frame/image`,
      imageAlt: "Swap on Base with 1% auto-burn to $TOBY.",
      buttons: [
        { label: "Enter Toby Swapper", action: { type: "launch_url", url: site } },
        { label: "More 🔥",            action: "post" },
      ],
      postUrl: `${site}/api/frame/post`,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
