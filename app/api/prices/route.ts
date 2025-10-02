import { NextResponse } from "next/server";

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
// Base mainnet WETH for ETH pricing
const WETH_BASE = "0x4200000000000000000000000000000000000006";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // comma-separated list of addresses; allow literal "ETH"
  const raw = (searchParams.get("addresses") || "").trim();
  if (!raw) return NextResponse.json({ prices: {} });

  const addrs = raw.split(",").map(s => s.trim()).filter(Boolean);
  const unique = Array.from(new Set(addrs));

  // map ETH → WETH address for pricing
  const addrForPrice = (a: string) => (a.toUpperCase() === "ETH" ? WETH_BASE : a);

  const out: Record<string, number> = {};

  // --- 1) Try Alchemy Market Data first (JSON-RPC) ---
  async function getFromAlchemy(addr: string) {
    if (!ALCHEMY_KEY) return undefined;
    try {
      const url = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
      // Alchemy Market Data: alchemy_getTokenPrice (if not available, we’ll fallback)
      const body = {
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getTokenPrice",
        params: [{ contractAddress: addr }],
      };
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        // small timeout guard
        cache: "no-store",
      });
      if (!r.ok) return undefined;
      const j = await r.json();
      // a few possible shapes; keep this tolerant
      const usd =
        j?.result?.usdPrice ??
        j?.result?.tokenPrice?.usdPrice ??
        j?.result?.price ??
        j?.result?.priceUsd;
      if (usd && isFinite(Number(usd))) return Number(usd);
      return undefined;
    } catch {
      return undefined;
    }
  }

  // --- 2) Fallback: Dexscreener ---
  async function getFromDexscreener(addr: string) {
    try {
      const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`, {
        cache: "no-store",
      });
      if (!r.ok) return undefined;
      const j = await r.json();
      const price = j?.pairs?.[0]?.priceUsd;
      if (price && isFinite(Number(price))) return Number(price);
      return undefined;
    } catch {
      return undefined;
    }
  }

  for (const a of unique) {
    const addr = addrForPrice(a);
    let usd = await getFromAlchemy(addr);
    if (usd === undefined) usd = await getFromDexscreener(addr);
    // If still undefined, return 0 to keep UI stable
    out[a] = usd ?? 0;
  }

  return NextResponse.json({ prices: out }, { status: 200 });
}
