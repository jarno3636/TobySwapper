// app/api/holders/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";  // always execute (we still in-memory cache)
export const revalidate = 0;             // do not let ISR cache this handler

const MORALIS  = process.env.MORALIS_API_KEY;
const COVALENT = process.env.COVALENT_API_KEY;
const BASESCAN = process.env.BASESCAN_API_KEY;

type CacheEntry = { value: number | null; source: string; ts: number };
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const cache = new Map<string, CacheEntry>();

const numOrNull = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

async function safeFetchJSON(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, { ...init, cache: "no-store" });
    if (!res.ok) return { ok: false, err: `http ${res.status}`, json: null as any };
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return { ok: false, err: "not-json", json: null as any };
    const json = await res.json();
    return { ok: true, err: null, json };
  } catch (e: any) {
    return { ok: false, err: e?.message || "fetch-failed", json: null as any };
  }
}

/* ---------- Providers (best → fallback) ---------- */

// 1) Moralis v2.2 (try base + 0x2105)
async function tryMoralis(address: string) {
  if (!MORALIS) return { holders: null, source: "moralis:missing-key", detail: null };
  for (const chain of ["base", "0x2105"]) {
    const url = `https://deep-index.moralis.io/api/v2.2/erc20/${address}/holders?chain=${chain}&limit=1`;
    const { ok, err, json } = await safeFetchJSON(url, { headers: { "X-API-Key": MORALIS } });
    if (!ok) {
      console.error("[holders] moralis", chain, address, err);
      continue;
    }
    const total = numOrNull(json?.total);
    if (total !== null) return { holders: total, source: `moralis:${chain}`, detail: null };
  }
  return { holders: null, source: "moralis:none", detail: null };
}

// 2) Covalent (Base chain id 8453)
async function tryCovalent(address: string) {
  if (!COVALENT) return { holders: null, source: "covalent:missing-key", detail: null };
  const url = `https://api.covalenthq.com/v1/8453/tokens/${address}/token_holders/?page-size=1&key=${COVALENT}`;
  const { ok, err, json } = await safeFetchJSON(url);
  if (!ok) {
    console.error("[holders] covalent", address, err);
    return { holders: null, source: "covalent:err", detail: err };
  }
  const total =
    json?.data?.pagination?.total_count ??
    json?.data?.pagination?.count ??
    json?.data?.items_count;
  const n = numOrNull(total);
  return { holders: n, source: n !== null ? "covalent" : "covalent:parse", detail: null };
}

// 3a) BaseScan tokenholderlist (lower bound if paginated)
async function tryBaseScanList(address: string) {
  if (!BASESCAN) return { holders: null, source: "basescan:missing-key", detail: null };
  const url = `https://api.basescan.org/api?module=token&action=tokenholderlist&contractaddress=${address}&page=1&offset=10000&apikey=${BASESCAN}`;
  const { ok, err, json } = await safeFetchJSON(url);
  if (!ok) {
    console.error("[holders] basescan:list", address, err);
    return { holders: null, source: "basescan:list:err", detail: err };
  }
  const n = Array.isArray(json?.result) ? numOrNull(json.result.length) : null;
  return { holders: n, source: n !== null ? "basescan:list" : "basescan:list:parse", detail: null };
}

// 3b) BaseScan tokenholderchart (last point “Holder”)
async function tryBaseScanChart(address: string) {
  if (!BASESCAN) return { holders: null, source: "basescan:missing-key", detail: null };
  const url = `https://api.basescan.org/api?module=token&action=tokenholderchart&contractaddress=${address}&range=365&apikey=${BASESCAN}`;
  const { ok, err, json } = await safeFetchJSON(url);
  if (!ok) {
    console.error("[holders] basescan:chart", address, err);
    return { holders: null, source: "basescan:chart:err", detail: err };
  }
  const arr = Array.isArray(json?.result) ? json.result : [];
  const last = arr[arr.length - 1];
  const n = last ? numOrNull(last.Holder ?? last.holders ?? last.count) : null;
  return { holders: n, source: n !== null ? "basescan:chart" : "basescan:chart:parse", detail: null };
}

// 4) DexScreener (opportunistic)
async function tryDexScreener(address: string) {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
  const { ok, err, json } = await safeFetchJSON(url);
  if (!ok) {
    console.error("[holders] dexscreener", address, err);
    return { holders: null, source: "dexscreener:err", detail: err };
  }
  const candidates = [
    json?.holders,
    json?.pair?.holders,
    json?.pairs?.[0]?.holders,
    json?.token?.holders,
  ];
  for (const c of candidates) {
    const n = numOrNull(c);
    if (n !== null) return { holders: n, source: "dexscreener", detail: null };
  }
  return { holders: null, source: "dexscreener:parse", detail: null };
}

/* ---------- Route ---------- */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();
  const debug = searchParams.get("debug") === "1";

  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  // Cache
  const key = address.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return NextResponse.json(
      debug
        ? { holders: hit.value, source: `cache:${hit.source}`, cachedAt: hit.ts }
        : { holders: hit.value, source: `cache:${hit.source}` },
      { status: 200 }
    );
  }

  // Try providers in order
  const attempts = [];
  const m = await tryMoralis(address);      attempts.push(m);
  if (m.holders !== null) { cache.set(key, { value: m.holders, source: m.source, ts: Date.now() }); return NextResponse.json(debug ? { ...m, cached: false } : { holders: m.holders, source: m.source }); }

  const c = await tryCovalent(address);     attempts.push(c);
  if (c.holders !== null) { cache.set(key, { value: c.holders, source: c.source, ts: Date.now() }); return NextResponse.json(debug ? { ...c, cached: false } : { holders: c.holders, source: c.source }); }

  const bl = await tryBaseScanList(address); attempts.push(bl);
  if (bl.holders !== null) { cache.set(key, { value: bl.holders, source: bl.source, ts: Date.now() }); return NextResponse.json(debug ? { ...bl, cached: false } : { holders: bl.holders, source: bl.source }); }

  const bc = await tryBaseScanChart(address); attempts.push(bc);
  if (bc.holders !== null) { cache.set(key, { value: bc.holders, source: bc.source, ts: Date.now() }); return NextResponse.json(debug ? { ...bc, cached: false } : { holders: bc.holders, source: bc.source }); }

  const d = await tryDexScreener(address);  attempts.push(d);
  if (d.holders !== null) { cache.set(key, { value: d.holders, source: d.source, ts: Date.now() }); return NextResponse.json(debug ? { ...d, cached: false } : { holders: d.holders, source: d.source }); }

  // Nothing worked
  cache.set(key, { value: null, source: "none", ts: Date.now() });
  return NextResponse.json(
    debug ? { holders: null, source: "none", attempts } : { holders: null, source: "none" },
    { status: 200 }
  );
}
