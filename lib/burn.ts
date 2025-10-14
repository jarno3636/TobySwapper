// lib/burn.ts
import { useQuery, useQueryClient } from "@tanstack/react-query";

type BurnResp = { ok: boolean; totalHuman: string };

async function fetchBurnTotal(): Promise<string | null> {
  const r = await fetch(`/api/burn/total?ts=${Date.now()}`, { cache: "no-store" });
  const j = (await r.json()) as BurnResp;
  if (!j?.ok) return null;
  // totalHuman might be "123,456.78" or plain; normalize to a string we can show
  return j.totalHuman ?? null;
}

export const BURN_TOTAL_QK = ["burnTotal"] as const;

export function useBurnTotal() {
  return useQuery({
    queryKey: BURN_TOTAL_QK,
    queryFn: fetchBurnTotal,
    // tune to your liking
    staleTime: 10_000,           // was in your QueryClient defaults
    refetchInterval: 15_000,     // periodically refresh so Share updates on its own
    refetchOnWindowFocus: false, // keep your current behavior
  });
}

// Optional: handy helper to invalidate from anywhere (e.g., after a swap succeeds)
export function useInvalidateBurnTotal() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: BURN_TOTAL_QK });
}
