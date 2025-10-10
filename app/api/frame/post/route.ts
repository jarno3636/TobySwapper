import { NextResponse } from "next/server";

/**
 * Minimal POST handler — in a real case you could log interactions
 * or issue follow-up frames.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    // Example: could log body.castId, body.trustedData, etc.
    return NextResponse.json({ ok: true, received: !!body });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
}
