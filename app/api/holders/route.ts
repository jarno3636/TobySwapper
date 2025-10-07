import { NextResponse } from "next/server";

// Revalidate page ISR every 6 hours (cold starts reuse cache)
export const revalidate = 21600; // 6h

const MORALIS = process.env.MORALIS_API_KEY;
const COVALENT = process.env.COVALENT_API_KEY;
const BASESCAN = process.env.BASESCAN_API_KEY;

// Simple in-memory cache (per serverless instance)
type CacheEntry = { value: number | null; source: string; ts: number };
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const holdersCache: Map<string, CacheEntry> = new Map();

function getCached(address: string): CacheEntry | null {
  const hit = holdersCache.get(address.toLowerCase());
  if (!hit) return null;
  if (Date.now() - hit.ts < CACHE_TTL_MS) return hit;
  holdersCache.delete(address.toLowerCase());
  return null;
}
function setCached(address: string, value: number | null, source: string) {
  holdersCache.set(address.toLowerCase(), { value, source, ts: Date.now() });
}

async function safeFetchJSON(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, { ...init, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function numOrNull(x: unknown): number | null {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* ---------- Providers ---------- */

// 1) Moralis: https://docs.moralis.io/web3-data-api/evm/reference/get-erc20-token-holders
async function tryMoralis(address: string): Promise<number | null> {
  if (!MORALIS) return null;
  const url = `https://deep-index.moralis.io/api/v2.2/erc20/${address}/holders?chain=base&limit=1`;
  const json = await safeFetchJSON(url, { headers: { "X-API-Key": MORALIS } });
  // Common shapes: { total: number, ... } OR sometimes { result: [...], total: n }
  return numOrNull(json?.total);
}

// 2) Covalent: https://www.covalenthq.com/docs/api/#/0/Class-A/get_v1__chain_id__tokens__address__token_holders__get
async function tryCovalent(address: string): Promise<number | null> {
  if (!COVALENT) return null;
  const url = `https://api.covalenthq.com/v1/8453/tokens/${address}/token_holders/?page-size=1&key=${COVALENT}`;
  const json = await safeFetchJSON(url);
  // Often: { data: { pagination: { total_count } } }
  const total =
    json?.data?.pagination?.total_count ??
    json?.data?.pagination?.count ??
    json?.data?.items_count;
  return numOrNull(total);
}

// 3) BaseScan (Etherscan-style)
// We’ll use tokenholderlist. If it returns an array, we only know page size;
// but for many tokens this still equals total when small. Good enough as a backup.
async function tryBaseScan(address: string): Promise<number | null> {
  if (!BASESCAN) return null;
  const url = `https://api.basescan.org/api?module=token&action=tokenholderlist&contractaddress=${address}&page=1&offset=10000&apikey=${BASESCAN}`;
  const json = await safeFetchJSON(url);
  if (Array.isArray(json?.result)) {
    // If BaseScan caps page, this is a lower bound. Still better than null.
    return numOrNull(json.result.length);
  }
  return null;
}

// 4) DexScreener (metadata sometimes includes holders)
async function tryDexScreener(address: string): Promise<number | null> {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
  const json = await safeFetchJSON(url);
  // Try common locations
  const candidates = [
    json?.holders,
    json?.pair?.holders,
    json?.pairs?.[0]?.holders,
    json?.token?.holders,
  ];
  for (const c of candidates) {
    const n = numOrNull(c);
    if (n) return n;
  }
  return null;
}

/* ---------- Route ---------- */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  // 0) Cache hit?
  const cached = getCached(address);
  if (cached) {
    return NextResponse.json({ holders: cached.value, source: `cache:${cached.source}` }, { status: 200 });
  }

  // 1) Moralis
  let holders = await tryMoralis(address);
  if (holders) {
    setCached(address, holders, "moralis");
    return NextResponse.json({ holders, source: "moralis" }, { status: 200 });
  }

  // 2) Covalent
  holders = await tryCovalent(address);
  if (holders) {
    setCached(address, holders, "covalent");
    return NextResponse.json({ holders, source: "covalent" }, { status: 200 });
  }

  // 3) BaseScan
  holders = await tryBaseScan(address);
  if (holders) {
    setCached(address, holders, "basescan");
    return NextResponse.json({ holders, source: "basescan" }, { status: 200 });
  }

  // 4) DexScreener
  holders = await tryDexScreener(address);
  if (holders) {
    setCached(address, holders, "dexscreener");
    return NextResponse.json({ holders, source: "dexscreener" }, { status: 200 });
  }

  // Couldn’t get any number — cache null so we don’t hammer on reloads
  setCached(address, null, "none");
  return NextResponse.json({ holders: null, source: "none" }, { status: 200 });
}
