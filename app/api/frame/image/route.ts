import { NextResponse } from "next/server";

/** Serves the OG image with long cache for instant loads. */
export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";
  // use the new, real file
  const img = new URL("/og/tobyswap-card-1200x630.png", base);

  const res = await fetch(img, { cache: "force-cache" });
  const buf = await res.arrayBuffer();

  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
