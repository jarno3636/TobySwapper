"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type PriceMap = Record<string, number>;

function toKey(k: string) {
  // accept "ETH" as-is; every address -> lowercase
  return k.toLowerCase() === "eth" ? "ETH" : k.toLowerCase();
}

/**
 * Fetch USD prices for a set of addresses/symbols.
 * - Keeps the previous data during refresh (no flicker to zero)
 * - Normalizes keys to lowercase (addresses) and "ETH" symbol
 * - Polls every 15s with simple retry/backoff
 */
export function useUsdPrices(addresses: (string | undefined)[]) {
  const list = useMemo(
    () => Array.from(new Set(addresses.filter(Boolean).map(a => toKey(a!)))),
    [addresses]
  );

  const [data, setData] = useState<PriceMap>({});
  const [loading, setLoading] = useState(false);
  const retryRef = useRef(0);

  useEffect(() => {
    if (list.length === 0) return;

    let alive = true;
    let t: any;

    const fetchOnce = async () => {
      // do NOT clear data here; we keep stale while revalidating
      setLoading(true);
      try {
        const params = new URLSearchParams({ addresses: list.join(",") });
        const r = await fetch(`/api/prices?${params.toString()}`, { cache: "no-store" });
        const j = await r.json();

        // Normalize keys on the way in.
        const raw = (j?.prices ?? {}) as PriceMap;
        const normalized: PriceMap = {};
        for (const [k, v] of Object.entries(raw)) {
          normalized[toKey(k)] = v;
        }

        if (alive) {
          setData(prev => ({ ...prev, ...normalized })); // merge → never blank out
          setLoading(false);
          retryRef.current = 0;
        }
      } catch {
        if (alive) {
          setLoading(false);
          // backoff & retry
          retryRef.current = Math.min(retryRef.current + 1, 5);
        }
      } finally {
        if (alive) {
          const delay = retryRef.current ? 3000 * retryRef.current : 15000; // 15s steady, backoff on errors
          t = setTimeout(fetchOnce, delay);
        }
      }
    };

    fetchOnce();
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [list]);

  return { prices: data, isLoading: loading };
}

/** Convenience for single symbol/address (symbol "ETH" supported) */
export function useUsdPriceSingle(addrOrSymbol?: string) {
  const key = addrOrSymbol ? toKey(addrOrSymbol) : undefined;
  const { prices } = useUsdPrices(key ? [key] : []);

  // Stable fallback for common assets so they never flash to 0 if API hiccups.
  const FALLBACKS: PriceMap = {
    ETH: 3000,                      // pick a sane baseline; UI will update when API returns
  };
  // USDC by address or symbol → 1.0 fallback
  const USDC_ADDR = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"; // lowercase

  if (!key) return 0;

  // Prefer API price; otherwise fallbacks for ETH & USDC
  if (prices[key] != null) return prices[key];
  if (key === "ETH") return FALLBACKS.ETH;
  if (key === USDC_ADDR || key === "usdc") return 1;

  return 0;
}
