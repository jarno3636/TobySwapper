import { NextResponse } from "next/server";

/** Legacy frame image endpoint kept as a cheap cached redirect for older embeds. */
export async function GET(request: Request) {
  const target = new URL("/og/tobyswap-card-1200x630.png", request.url);
  return NextResponse.redirect(target, {
    status: 308,
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
