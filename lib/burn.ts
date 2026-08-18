"use client";

import { useEffect } from "react";
import { formatUnits } from "viem";
import { useReadContract } from "wagmi";
import { base } from "wagmi/chains";
import { SWAPPER } from "@/lib/addresses";

const BURN_ABI = [
  { type: "function", name: "totalTobyBurned", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

/**
 * Burn total is read directly from Base in the browser. This intentionally avoids
 * a TobySwap/Vercel API hop for a value that already lives onchain.
 */
export function useBurnTotal() {
  const read = useReadContract({
    address: SWAPPER,
    abi: BURN_ABI,
    functionName: "totalTobyBurned",
    chainId: base.id,
    query: {
      staleTime: 5 * 60_000,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  });

  useEffect(() => {
    const refresh = () => { void read.refetch(); };
    window.addEventListener("tobyswap:burn-updated", refresh);
    window.addEventListener("tobyswap:burn-display-refresh", refresh);
    return () => {
      window.removeEventListener("tobyswap:burn-updated", refresh);
      window.removeEventListener("tobyswap:burn-display-refresh", refresh);
    };
  }, [read.refetch]);

  return {
    ...read,
    data: typeof read.data === "bigint" ? formatUnits(read.data, 18) : null,
  };
}

export function useInvalidateBurnTotal() {
  return () => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("tobyswap:burn-display-refresh"));
  };
}
