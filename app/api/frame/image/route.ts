import { NextResponse } from "next/server";

export async function GET() {
  // Serve your OG PNG as the frame image
  const res = await fetch(new URL("/og.PNG", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  const buf = await res.arrayBuffer();
  return new NextResponse(Buffer.from(buf), { headers: { "Content-Type": "image/png" } });
}
