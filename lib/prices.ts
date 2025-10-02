// lib/prices.ts
"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type PriceMap = Record<string, number>;

/** normalize: keep "ETH" as-is, everything else lowercased address */
function keyOf(x?: string) {
  if (!x) return "";
  return x === "ETH" ? "ETH" : x.toLowerCase();
}

/**
 * Robust price hook
 * - normalizes address keys to lowercase to avoid cache misses
 * - keeps last good values while fetching (no $0 flash)
 * - seeds stable coins & ETH with sensible defaults
 */
export function useUsdPrices(addresses: (string | undefined)[]) {
  const list = useMemo(
    () => Array.from(new Set(addresses.filter(Boolean).map(keyOf) as string[])),
    [addresses]
  );

  // keep a sticky cache so we never flash to 0 while fetching
  const [cache, setCache] = useState<PriceMap>({
    ETH: 0, // will be replaced
    // seed obvious pegs so USDC never reads 0 while loading
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": 1, // USDC on Base (lowercased)
  });
  const [loading, setLoading] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (list.length === 0) return;

    (async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ addresses: list.join(",") });
        const r = await fetch(`/api/prices?${params.toString()}`, { cache: "no-store" });
        const j = (await r.json()) as { prices?: PriceMap };
        if (!aliveRef.current) return;

        const incoming = Object.fromEntries(
          Object.entries(j?.prices ?? {}).map(([k, v]) => [keyOf(k), v])
        );

        // merge (don’t drop old keys → prevents flicker)
        setCache((prev) => ({ ...prev, ...incoming }));
      } catch {
        // keep previous cache on errors
      } finally {
        if (aliveRef.current) setLoading(false);
      }
    })();
  }, [list.join(",")]); // fetch only when the *set* changes

  return { prices: cache, isLoading: loading };
}

/** Convenience: single symbol/address with sticky value */
export function useUsdPriceSingle(addrOrSymbol?: string) {
  const key = keyOf(addrOrSymbol);
  const { prices } = useUsdPrices(key ? [key] : []);
  // extra guards: stable fallback for USDC if API ever misses
  if (key === "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913") return 1;
  return key ? prices[key] ?? 0 : 0;
}
