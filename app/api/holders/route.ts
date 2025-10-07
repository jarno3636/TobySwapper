import { NextResponse } from "next/server";

// Revalidate this route every 60s (Route Handler style)
export const revalidate = 60;

// Put your BaseScan API key in .env / Vercel Project Settings
// BASESCAN_API_KEY=xxxxxxxx
const KEY = process.env.BASESCAN_API_KEY;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }
  if (!KEY) {
    // No key configured — UI will show "—"
    return NextResponse.json({ holders: null }, { status: 200 });
  }

  try {
    // Etherscan-style endpoint (BaseScan compatible)
    const url = `https://api.basescan.org/api?module=token&action=tokenholderchart&contractaddress=${address}&range=365&apikey=${KEY}`;

    // Use standard RequestInit; caching controlled by `revalidate` export above
    const r = await fetch(url, { cache: "force-cache" });
    const json = await r.json();

    // expected: { status, message, result: [{ Date, Holder }, ...] }
    const series = Array.isArray(json?.result) ? json.result : [];
    const last = series[series.length - 1];
    const holders =
      last && Number.isFinite(Number(last?.Holder)) ? Number(last.Holder) : null;

    return NextResponse.json({ holders }, { status: 200 });
  } catch {
    return NextResponse.json({ holders: null }, { status: 200 });
  }
}
