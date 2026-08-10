import { NextResponse } from "next/server";
import { isAddress } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const WETH_BASE = "0x4200000000000000000000000000000000000006";
const USDC_BASE = "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913";

type PriceMap = Record<string, number>;

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function alchemyByAddress(addresses: string[]): Promise<PriceMap> {
  if (!ALCHEMY_KEY || addresses.length === 0) return {};
  try {
    const j = await fetchJson("https://api.g.alchemy.com/prices/v1/tokens/by-address", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ALCHEMY_KEY}`,
      },
      body: JSON.stringify({
        addresses: addresses.map((address) => ({ network: "base-mainnet", address })),
      }),
    });

    const out: PriceMap = {};
    for (const row of j?.data ?? []) {
      const address = String(row?.address ?? "").toLowerCase();
      const usd = num(row?.prices?.find?.((p: any) => p?.currency === "usd")?.value)
        ?? num(row?.price)
        ?? num(row?.usdPrice);
      if (address && usd) out[address] = usd;
    }
    return out;
  } catch {
    return {};
  }
}

async function alchemyEth(): Promise<number | undefined> {
  if (!ALCHEMY_KEY) return undefined;
  try {
    const j = await fetchJson("https://api.g.alchemy.com/prices/v1/tokens/by-symbol?symbols=ETH", {
      headers: { authorization: `Bearer ${ALCHEMY_KEY}` },
    });
    const row = j?.data?.[0];
    return num(row?.prices?.find?.((p: any) => p?.currency === "usd")?.value)
      ?? num(row?.price)
      ?? num(row?.usdPrice);
  } catch {
    return undefined;
  }
}

async function dexPrice(address: string): Promise<number | undefined> {
  try {
    const j = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    const pairs = (j?.pairs ?? []).filter((p: any) => p?.chainId === "base" && num(p?.priceUsd));
    if (!pairs.length) return undefined;
    pairs.sort((a: any, b: any) => (num(b?.liquidity?.usd) ?? 0) - (num(a?.liquidity?.usd) ?? 0));
    return num(pairs[0]?.priceUsd);
  } catch {
    return undefined;
  }
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("addresses")?.trim() ?? "";
  if (!raw) return NextResponse.json({ prices: {} });

  const requested = Array.from(new Set(raw.split(",").map((s) => s.trim()).filter(Boolean)));
  const normalizedAddresses = Array.from(new Set(
    requested
      .map((k) => k.toUpperCase() === "ETH" ? WETH_BASE : k)
      .filter((k) => isAddress(k))
      .map((k) => k.toLowerCase()),
  ));

  const alchemy = await alchemyByAddress(normalizedAddresses);
  const ethFromAlchemy = requested.some((k) => k.toUpperCase() === "ETH") ? await alchemyEth() : undefined;

  const prices: PriceMap = {};
  for (const key of requested) {
    const upper = key.toUpperCase();
    const addr = upper === "ETH" ? WETH_BASE.toLowerCase() : key.toLowerCase();

    let usd = upper === "ETH" ? ethFromAlchemy : alchemy[addr];
    if (!usd) usd = alchemy[addr];
    if (!usd) usd = await dexPrice(addr);

    // USDC should remain useful even if every external price API is having a bad minute.
    if (!usd && addr === USDC_BASE.toLowerCase()) usd = 1;
    prices[upper === "ETH" ? "ETH" : addr] = usd ?? 0;
  }

  return NextResponse.json(
    { prices, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=120" } },
  );
}
