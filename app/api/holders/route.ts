import { NextResponse } from "next/server";

const KEY = process.env.BASESCAN_API_KEY;

// Minimal safe fetch wrapper
async function safeFetchJSON(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { cache: "no-store" }); // fetch fresh each time
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  let holders: number | null = null;

  /* --------------------
     1️⃣ Try BaseScan first
     -------------------- */
  if (KEY) {
    const baseScanUrl = `https://api.basescan.org/api?module=token&action=tokenholderlist&contractaddress=${address}&page=1&offset=100&apikey=${KEY}`;
    const baseScan = await safeFetchJSON(baseScanUrl);

    if (Array.isArray(baseScan?.result) && baseScan.result.length > 0) {
      holders = baseScan.result.length;
    }
  }

  /* --------------------
     2️⃣ Fallback: DexScreener
     -------------------- */
  if (holders === null) {
    const dexUrl = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
    const dex = await safeFetchJSON(dexUrl);

    // DexScreener sometimes embeds this info in "pair" metadata
    const altCount = dex?.pair?.holders || dex?.holders || null;
    if (typeof altCount === "number" && altCount > 0) {
      holders = altCount;
    }
  }

  /* --------------------
     3️⃣ Return result once
     -------------------- */
  return NextResponse.json({ holders }, { status: 200 });
}
