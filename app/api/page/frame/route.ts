import { NextResponse } from "next/server";

/**
 * Returns the same frame data, but intended for the main page.
 * Warpcast uses this when someone shares your root URL.
 */
export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";
  const image = `${site}/og.PNG`;

  return NextResponse.json({
    version: "next",
    title: "Toby Swapper 🐸",
    image,
    imageAlt: "Swap on Base with 1% auto-burn to $TOBY.",
    buttons: [
      { label: "Enter Toby Swapper", action: { type: "launch_url", url: site } },
    ],
    postUrl: `${site}/api/frame/post`,
  });
}
