// lib/prices.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PriceMap = Record<string, number>;
const TTL_MS = 60_000;

// Type guard so TS knows items are strings after filtering
const isStr = (x: unknown): x is string => typeof x === "string" && x.length > 0;

// Normalize keys: "ETH" stays "ETH"; ERC20 addresses are lowercased
const normKey = (k: string) => (k === "ETH" ? "ETH" : k.toLowerCase());

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function loadCache(keys: string[]): PriceMap {
  const now = Date.now();
  const out: PriceMap = {};
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(`price:${k}`);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { v: unknown; t: unknown };
      const v = safeNum(parsed?.v);
      const t = Number(parsed?.t);
      if (v !== undefined && Number.isFinite(t) && now - t < TTL_MS) {
        out[k] = v;
      }
    } catch {
      // ignore bad cache entries
    }
  }
  return out;
}

function saveCache(map: PriceMap) {
  const t = Date.now();
  for (const [k, v] of Object.entries(map)) {
    const good = safeNum(v);
    if (good !== undefined) {
      try {
        localStorage.setItem(`price:${k}`, JSON.stringify({ v: good, t }));
      } catch {
        // quota errors etc. — ignore
      }
    }
  }
}

export function useUsdPrices(addresses: (string | undefined)[]) {
  // Properly narrow to strings before mapping
  const list = useMemo(
    () => Array.from(new Set(addresses.filter(isStr).map(normKey))),
    [addresses]
  );

  // seed with cached values to avoid 0-flash
  const [data, setData] = useState<PriceMap>(() => loadCache(list));
  const [loading, setLoading] = useState(false);
  const prevGood = useRef<PriceMap>(data);

  useEffect(() => {
    if (list.length === 0) {
      setData({});
      return;
    }

    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ addresses: list.join(",") });
        const res = await fetch(`/api/prices?${params.toString()}`, { cache: "no-store" });
        const j = await res.json();
        const incoming = (j?.prices ?? {}) as Record<string, unknown>;

        const next: PriceMap = {};
        for (const k of list) {
          // prefer fresh; fall back to last good; then existing cache; finally 0
          next[k] = safeNum(incoming[k]) ?? prevGood.current[k] ?? data[k] ?? 0;
        }

        if (alive) {
          setData(next);
          prevGood.current = next;
          saveCache(next);
        }
      } catch {
        // keep previous good data on network errors
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]); // depend only on list; internal fallbacks handle stale data

  return { prices: data, isLoading: loading };
}

export function useUsdPriceSingle(addrOrSymbol?: string) {
  const key = addrOrSymbol ? normKey(addrOrSymbol) : undefined;
  const { prices } = useUsdPrices(key ? [key] : []);
  return key ? prices[key] ?? 0 : 0;
}
