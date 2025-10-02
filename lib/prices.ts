// lib/prices.ts
"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type PriceMap = Record<string, number>;
const TTL_MS = 60_000; // cache prices for 60s

function normKey(k: string) {
  // Use "ETH" for native; lowercase addresses for ERC20s
  if (!k) return k;
  return k === "ETH" ? "ETH" : k.toLowerCase();
}

function loadCache(keys: string[]) {
  const out: PriceMap = {};
  const now = Date.now();
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(`price:${k}`);
      if (!raw) continue;
      const { v, t } = JSON.parse(raw) as { v: number; t: number };
      if (now - t < TTL_MS && typeof v === "number" && isFinite(v) && v > 0) {
        out[k] = v;
      }
    } catch {}
  }
  return out;
}

function saveCache(map: PriceMap) {
  const t = Date.now();
  for (const [k, v] of Object.entries(map)) {
    try {
      if (typeof v === "number" && isFinite(v) && v > 0) {
        localStorage.setItem(`price:${k}`, JSON.stringify({ v, t }));
      }
    } catch {}
  }
}

export function useUsdPrices(addresses: (string | undefined)[]) {
  // normalize + dedupe
  const list = useMemo(
    () =>
      Array.from(new Set(addresses.filter(Boolean).map(a => normKey(a as string)))),
    [addresses]
  );

  // start with cached values to avoid $0 flash
  const cachedAtStart = useMemo(() => loadCache(list), [list]);
  const [data, setData] = useState<PriceMap>(cachedAtStart);
  const [loading, setLoading] = useState<boolean>(false);
  const prevGood = useRef<PriceMap>(cachedAtStart);

  useEffect(() => {
    if (list.length === 0) {
      setData({});
      return;
    }

    // Provide instant sane defaults for stables
    const seed: PriceMap = { ...cachedAtStart };
    for (const k of list) {
      // If token is USDC on Base (or any “usdc” address), default to 1 until fetch updates
      if (k === "ETH") continue;
      if (!seed[k] && /833589fcd6edb6e08f4c7c32d4f71b54bda02913/i.test(k)) {
        seed[k] = 1;
      }
    }
    setData(seed);

    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ addresses: list.join(",") });
        // no-store to always attempt fresh, but we keep stale-good values until success
        const r = await fetch(`/api/prices?${params.toString()}`, { cache: "no-store" });
        const j = await r.json();
        const fresh: PriceMap = {};
        const incoming = (j?.prices || {}) as PriceMap;

        // Only accept good numbers; otherwise keep previous values (no flicker to 0)
        for (const k of list) {
          const v = incoming[k];
          if (typeof v === "number" && isFinite(v) && v > 0) {
            fresh[k] = v;
          } else if (prevGood.current[k]) {
            fresh[k] = prevGood.current[k];
          } else if (seed[k]) {
            fresh[k] = seed[k];
          }
        }

        if (alive) {
          setData(fresh);
          prevGood.current = fresh;
          saveCache(fresh);
        }
      } catch {
        // keep previous good data; do nothing
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [list]); // eslint-disable-line react-hooks/exhaustive-deps

  return { prices: data, isLoading: loading };
}

/** Convenience for one key (symbol "ETH" or address) */
export function useUsdPriceSingle(addrOrSymbol?: string) {
  const key = addrOrSymbol ? normKey(addrOrSymbol) : undefined;
  const { prices } = useUsdPrices(key ? [key] : []);
  return key ? (prices[key] ?? 0) : 0;
}
