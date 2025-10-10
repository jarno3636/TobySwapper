"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type PriceMap = Record<string, number>;
const TTL_MS = 60_000;

const normKey = (k: string) => (k === "ETH" ? "ETH" : k.toLowerCase());

function safeNum(v: unknown) {
  const n = Number(v);
  return isFinite(n) && n > 0 ? n : undefined;
}

function loadCache(keys: string[]): PriceMap {
  const now = Date.now();
  const out: PriceMap = {};
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(`price:${k}`);
      if (!raw) continue;
      const { v, t } = JSON.parse(raw);
      if (now - t < TTL_MS) out[k] = safeNum(v) ?? 0;
    } catch {}
  }
  return out;
}

function saveCache(map: PriceMap) {
  const t = Date.now();
  for (const [k, v] of Object.entries(map)) {
    if (safeNum(v)) localStorage.setItem(`price:${k}`, JSON.stringify({ v, t }));
  }
}

export function useUsdPrices(addresses: (string | undefined)[]) {
  const list = useMemo(() => Array.from(new Set(addresses.filter(Boolean).map(normKey))), [addresses]);
  const [data, setData] = useState(() => loadCache(list));
  const [loading, setLoading] = useState(false);
  const prevGood = useRef(data);

  useEffect(() => {
    if (list.length === 0) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ addresses: list.join(",") });
        const res = await fetch(`/api/prices?${params}`, { cache: "no-store" });
        const j = await res.json();
        const incoming = j?.prices || {};
        const next: PriceMap = {};
        for (const k of list) {
          next[k] = safeNum(incoming[k]) ?? prevGood.current[k] ?? data[k] ?? 0;
        }
        if (alive) {
          setData(next);
          prevGood.current = next;
          saveCache(next);
        }
      } catch {
        // silent fallback
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [list]);

  return { prices: data, isLoading: loading };
}

export function useUsdPriceSingle(addrOrSymbol?: string) {
  const key = addrOrSymbol ? normKey(addrOrSymbol) : undefined;
  const { prices } = useUsdPrices(key ? [key] : []);
  return key ? prices[key] ?? 0 : 0;
}
