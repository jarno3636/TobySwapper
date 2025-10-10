import { NextResponse } from "next/server";

/**
 * Serves the OG image with long cache for instant loads.
 */
export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";
  const img = new URL("/og.PNG", base);

  const res = await fetch(img, { cache: "force-cache" });
  const buf = await res.arrayBuffer();

  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
