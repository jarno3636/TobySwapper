import { NextResponse } from "next/server";

// Put your BaseScan API key in .env as: BASESCAN_API_KEY=xxxx
const KEY = process.env.BASESCAN_API_KEY;

// We’ll use the tokenholderchart (last point ≈ latest holders). If this ever changes,
// we just return "-" gracefully.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }
  if (!KEY) {
    // no key configured — return null to show "—"
    return NextResponse.json({ holders: null }, { status: 200 });
  }

  try {
    // docs: Etherscan-style; BaseScan supports similar endpoints.
    const url = `https://api.basescan.org/api?module=token&action=tokenholderchart&contractaddress=${address}&range=365&apikey=${KEY}`;
    const r = await fetch(url, { next: { revalidate: 60 } });
    const json = await r.json();
    // expected shape: { status, message, result: [{ Date, Holder }, ...] }
    const series = Array.isArray(json?.result) ? json.result : [];
    const last = series[series.length - 1];
    const holders = last && Number.isFinite(Number(last?.Holder)) ? Number(last.Holder) : null;
    return NextResponse.json({ holders }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ holders: null }, { status: 200 });
  }
}
