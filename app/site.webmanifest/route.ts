// app/site.webmanifest/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";

  const manifest = {
    name: "Toby Swapper",
    short_name: "TobySwap",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0b",
    theme_color: "#0b0b0b",
    icons: [
      { src: `${site}/icons/toby-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${site}/icons/toby-512.png`, sizes: "512x512", type: "image/png", purpose: "any" }
    ],
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
