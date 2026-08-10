import { NextResponse } from "next/server";

export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";
  const manifest = {
    name: "Toby Swapper",
    short_name: "TobySwap",
    description: "Swap across the Tobyworld pond on Base.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf9f6",
    theme_color: "#faf9f6",
    icons: [
      { src: `${site}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${site}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
