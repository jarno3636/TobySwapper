"use client";
import { useEffect, useMemo, useState } from "react";

type PriceMap = Record<string, number>;

export function useUsdPrices(addresses: (string | undefined)[]) {
  const list = useMemo(
    () => Array.from(new Set(addresses.filter(Boolean) as string[])),
    [addresses]
  );

  const [data, setData] = useState<PriceMap>({});
  const [loading, setLoading] = useState(false);

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
        const r = await fetch(`/api/prices?${params.toString()}`, { cache: "no-store" });
        const j = await r.json();
        if (alive) setData(j?.prices ?? {});
      } catch {
        if (alive) setData({});
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [list]);

  return { prices: data, isLoading: loading };
}

/** Convenience helper for single symbol/address (symbol "ETH" supported) */
export function useUsdPriceSingle(addrOrSymbol?: string) {
  const { prices } = useUsdPrices(addrOrSymbol ? [addrOrSymbol] : []);
  return addrOrSymbol ? (prices[addrOrSymbol] ?? 0) : 0;
}
