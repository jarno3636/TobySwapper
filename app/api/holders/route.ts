import { NextResponse } from "next/server";

export const runtime = "nodejs";          // ensure Node runtime (not edge)
export const revalidate = 21600;          // ISR: 6h for the route itself
export const dynamic = "force-dynamic";   // always run (but we cache in memory)

// ----- ENV KEYS -----
// Add these in Vercel → Settings → Environment Variables
const MORALIS  = process.env.MORALIS_API_KEY;
const COVALENT = process.env.COVALENT_API_KEY;
const BASESCAN = process.env.BASESCAN_API_KEY;

// In-memory cache for 6h per lambda instance
type CacheEntry = { value: number | null; source: string; ts: number };
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const holdersCache = new Map<string, CacheEntry>();

function getCached(address: string): CacheEntry | null {
  const key = address.toLowerCase();
  const hit = holdersCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts < CACHE_TTL_MS) return hit;
  holdersCache.delete(key);
  return null;
}
function setCached(address: string, value: number | null, source: string) {
  holdersCache.set(address.toLowerCase(), { value, source, ts: Date.now() });
}

async function safeFetchJSON(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, { ...init, cache: "no-store" });
    if (!res.ok) return null;
    // Make sure it’s actually JSON
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    return await res.json();
  } catch {
    return null;
  }
}
const numOrNull = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/* ---------------- Providers (best → fallback) ---------------- */

// 1) Moralis (v2.2). Try both `base` and explicit `0x2105` in case of routing issues.
async function tryMoralis(address: string): Promise<number | null> {
  if (!MORALIS) return null;

  const heads = { headers: { "X-API-Key": MORALIS } };
  const urls = [
    `https://deep-index.moralis.io/api/v2.2/erc20/${address}/holders?chain=base&limit=1`,
    `https://deep-index.moralis.io/api/v2.2/erc20/${address}/holders?chain=0x2105&limit=1`,
  ];

  for (const url of urls) {
    const json = await safeFetchJSON(url, heads);
    // Moralis returns `{ total: number, page, page_size, ... }`
    const total = numOrNull(json?.total);
    if (total !== null) return total;
  }
  return null;
}

// 2) Covalent (Base chain id 8453)
// Format: data.pagination.total_count (sometimes `count` or `items_count`)
async function tryCovalent(address: string): Promise<number | null> {
  if (!COVALENT) return null;
  const url = `https://api.covalenthq.com/v1/8453/tokens/${address}/token_holders/?page-size=1&key=${COVALENT}`;
  const json = await safeFetchJSON(url);
  const total =
    json?.data?.pagination?.total_count ??
    json?.data?.pagination?.count ??
    json?.data?.items_count;
  const n = numOrNull(total);
  return n;
}

// 3) BaseScan (Etherscan-style) — lower bound if paginated
async function tryBaseScan(address: string): Promise<number | null> {
  if (!BASESCAN) return null;
  const url = `https://api.basescan.org/api?module=token&action=tokenholderlist&contractaddress=${address}&page=1&offset=10000&apikey=${BASESCAN}`;
  const json = await safeFetchJSON(url);
  if (Array.isArray(json?.result)) {
    return numOrNull(json.result.length);
  }
  return null;
}

// 4) DexScreener — opportunistic metadata
async function tryDexScreener(address: string): Promise<number | null> {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
  const json = await safeFetchJSON(url);
  const candidates = [
    json?.holders,
    json?.pair?.holders,
    json?.pairs?.[0]?.holders,
    json?.token?.holders,
  ];
  for (const c of candidates) {
    const n = numOrNull(c);
    if (n !== null) return n;
  }
  return null;
}

/* ---------------- Route ---------------- */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();
  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  const cached = getCached(address);
  if (cached) {
    return NextResponse.json(
      { holders: cached.value, source: `cache:${cached.source}` },
      { status: 200 }
    );
  }

  // Best → fallback chain
  let holders =
    (await tryMoralis(address)) ??
    (await tryCovalent(address)) ??
    (await tryBaseScan(address)) ??
    (await tryDexScreener(address));

  const source =
    holders != null
      ? (await tryMoralis(address)) != null
        ? "moralis"
        : (await tryCovalent(address)) != null
        ? "covalent"
        : (await tryBaseScan(address)) != null
        ? "basescan"
        : "dexscreener"
      : "none";

  // Cache (including null so we don’t hammer APIs on reloads)
  setCached(address, holders ?? null, source);

  return NextResponse.json({ holders: holders ?? null, source }, { status: 200 });
}
