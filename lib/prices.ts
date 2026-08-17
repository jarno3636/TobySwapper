// lib/prices.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PriceMap = Record<string, number>;
const TTL_MS = 5 * 60_000;

// Type guard so TS knows items are strings after filtering
const isStr = (x: unknown): x is string => typeof x === "string" && x.length > 0;

// Normalize keys: "ETH" stays "ETH"; ERC20 addresses are lowercased
const normKey = (k: string) => (k === "ETH" ? "ETH" : k.toLowerCase());

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function loadCache(keys: string[]): PriceMap {
  if (typeof window === "undefined") return {};
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

function allFresh(keys: string[]) {
  if (typeof window === "undefined" || keys.length === 0) return false;
  const now = Date.now();
  return keys.every((k) => {
    try {
      const raw = localStorage.getItem(`price:${k}`);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { v: unknown; t: unknown };
      return safeNum(parsed?.v) !== undefined && Number.isFinite(Number(parsed?.t)) && now - Number(parsed.t) < TTL_MS;
    } catch {
      return false;
    }
  });
}

function saveCache(map: PriceMap) {
  if (typeof window === "undefined") return;
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

type BatchWaiter = {
  keys: string[];
  resolve: (prices: PriceMap) => void;
};

let pendingKeys = new Set<string>();
let pendingWaiters: BatchWaiter[] = [];
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function requestPriceBatch(keys: string[]): Promise<PriceMap> {
  return new Promise((resolve) => {
    for (const key of keys) pendingKeys.add(key);
    pendingWaiters.push({ keys, resolve });

    if (pendingTimer) return;
    pendingTimer = setTimeout(async () => {
      const batch = Array.from(pendingKeys).sort();
      const waiters = pendingWaiters;
      pendingKeys = new Set<string>();
      pendingWaiters = [];
      pendingTimer = null;

      let prices: PriceMap = {};
      try {
        const params = new URLSearchParams({ addresses: batch.join(",") });
        // Allow the browser/CDN to honor the route's Cache-Control instead of
        // forcing a new Vercel invocation on every call.
        const res = await fetch(`/api/prices?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          const incoming = (json?.prices ?? {}) as Record<string, unknown>;
          for (const key of batch) {
            const value = safeNum(incoming[key]);
            if (value !== undefined) prices[key] = value;
          }
        }
      } catch {
        // Each hook falls back to its last-known-good local cache below.
      }

      for (const waiter of waiters) {
        const subset: PriceMap = {};
        for (const key of waiter.keys) {
          if (prices[key] !== undefined) subset[key] = prices[key];
        }
        waiter.resolve(subset);
      }
    }, 60);
  });
}

export function useUsdPrices(addresses: (string | undefined)[]) {
  // Convert unstable array literals from callers into a stable primitive key.
  // Without this, [TOBY, PATIENCE, TABOSHI] is a new array every render and can
  // repeatedly retrigger the pricing effect before the first request settles.
  const listKey = addresses.filter(isStr).map(normKey).sort().filter((v, i, a) => i === 0 || v !== a[i - 1]).join(",");
  const list = useMemo(() => (listKey ? listKey.split(",") : []), [listKey]);

  const [data, setData] = useState<PriceMap>(() => loadCache(list));
  const [loading, setLoading] = useState(false);
  const prevGood = useRef<PriceMap>(data);

  useEffect(() => {
    if (list.length === 0) {
      setData({});
      prevGood.current = {};
      return;
    }

    const cached = loadCache(list);
    if (Object.keys(cached).length) {
      setData((current) => ({ ...current, ...cached }));
      prevGood.current = { ...prevGood.current, ...cached };
    }

    if (allFresh(list)) return;

    let alive = true;
    setLoading(true);
    void requestPriceBatch(list).then((incoming) => {
      if (!alive) return;
      const next: PriceMap = {};
      for (const key of list) {
        next[key] = incoming[key] ?? prevGood.current[key] ?? cached[key] ?? 0;
      }
      setData(next);
      prevGood.current = next;
      saveCache(next);
    }).finally(() => {
      if (alive) setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [listKey]);

  return { prices: data, isLoading: loading };
}

export function useUsdPriceSingle(addrOrSymbol?: string) {
  const key = addrOrSymbol ? normKey(addrOrSymbol) : undefined;
  const { prices } = useUsdPrices(key ? [key] : []);
  return key ? prices[key] ?? 0 : 0;
}
