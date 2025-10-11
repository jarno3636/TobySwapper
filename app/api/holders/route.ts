import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASESCAN  = process.env.BASESCAN_API_KEY ?? "";
type CacheEntry = { value: number | null; source: string; ts: number };
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const cache = new Map<string, CacheEntry>();

const numOrNull = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

async function safeJSON(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, { ...init, cache: "no-store" });
    if (!res.ok) return { ok: false, json: null as any, err: `http ${res.status}` };
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return { ok: false, json: null as any, err: "not-json" };
    const json = await res.json();
    return { ok: true, json, err: null };
  } catch (e: any) {
    return { ok: false, json: null as any, err: e?.message || "fetch-failed" };
  }
}

/** 1) BaseScan tokenholderchart (usually best; needs key) */
async function tryBaseScanChart(addr: string) {
  if (!BASESCAN) return { holders: null, source: "basescan:missing-key" as const };
  const url = `https://api.basescan.org/api?module=token&action=tokenholderchart&contractaddress=${addr}&range=365&apikey=${BASESCAN}`;
  const { ok, json } = await safeJSON(url);
  if (!ok) return { holders: null, source: "basescan:err" as const };
  const arr = Array.isArray(json?.result) ? json.result : [];
  const last = arr[arr.length - 1];
  const n = last ? numOrNull(last.Holder ?? last.holders ?? last.count) : null;
  return { holders: n, source: n !== null ? "basescan:chart" as const : "basescan:parse" as const };
}

/** 2) RouteScan (Etherscan-compatible, often works w/out a key) */
async function tryRouteScanChart(addr: string) {
  const url = `https://api.routescan.io/v2/network/mainnet/evm/8453/etherscan/api?module=token&action=tokenholderchart&contractaddress=${addr}&range=365`;
  const { ok, json } = await safeJSON(url);
  if (!ok) return { holders: null, source: "routescan:err" as const };
  const arr = Array.isArray(json?.result) ? json.result : [];
  const last = arr[arr.length - 1];
  const n = last ? numOrNull(last.Holder ?? last.holders ?? last.count) : null;
  return { holders: n, source: n !== null ? "routescan:chart" as const : "routescan:parse" as const };
}

/** 3) DexScreener (opportunistic fallback) */
async function tryDexScreener(addr: string) {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${addr}`;
  const { ok, json } = await safeJSON(url);
  if (!ok) return { holders: null, source: "dexscreener:err" as const };
  const candidates = [
    json?.holders,
    json?.pair?.holders,
    json?.pairs?.[0]?.holders,
    json?.token?.holders,
  ];
  for (const c of candidates) {
    const n = numOrNull(c);
    if (n !== null) return { holders: n, source: "dexscreener" as const };
  }
  return { holders: null, source: "dexscreener:parse" as const };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();
  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  const key = address.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return NextResponse.json({ holders: hit.value, source: `cache:${hit.source}` }, { status: 200 });
  }

  const a = await tryBaseScanChart(address);
  if (a.holders !== null) { cache.set(key, { value: a.holders, source: a.source, ts: Date.now() }); return NextResponse.json(a); }

  const b = await tryRouteScanChart(address);
  if (b.holders !== null) { cache.set(key, { value: b.holders, source: b.source, ts: Date.now() }); return NextResponse.json(b); }

  const c = await tryDexScreener(address);
  cache.set(key, { value: c.holders, source: c.source, ts: Date.now() });
  return NextResponse.json(c, { status: 200 });
}
