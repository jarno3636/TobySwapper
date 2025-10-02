// hooks/useTokenBalance.ts
"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { erc20Abi } from "viem";
import { base } from "viem/chains";
import { useBalance, usePublicClient } from "wagmi";
import { USDC } from "@/lib/addresses";

/**
 * Returns a reliable balance for native or ERC-20:
 * 1) Try wagmi useBalance (fast + cached)
 * 2) If missing, fall back to direct ERC20 balanceOf + decimals via viem client
 *    (guarded so TS and runtime are both safe)
 */
export function useTokenBalance(user?: Address, token?: Address) {
  const client = usePublicClient({ chainId: base.id });

  const {
    data,
    isFetching,
    error,
    refetch,
  } = useBalance({
    address: user,
    token,
    chainId: base.id,
    // keep things calm & sticky:
    scopeKey: token ? `bal-${token}` : "bal-native",
    query: {
      enabled: Boolean(user),
      refetchInterval: 15_000,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      placeholderData: (prev: any) => prev,
    },
  });

  const [fallback, setFallback] = useState<{ value?: bigint; decimals?: number }>({});

  // When wagmi has no value for ERC-20, do a direct read (safe-guard client)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !token) return;

      // if wagmi already has a value, prefer it
      if (data?.value !== undefined && data?.decimals !== undefined) {
        if (!cancelled) setFallback({});
        return;
      }

      // viem client may be momentarily undefined during hydration—guard it
      if (!client) return;

      try {
        const [raw, dec] = await Promise.all([
          client.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [user],
          }) as Promise<bigint>,
          client.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "decimals",
          }) as Promise<number>,
        ]);

        if (!cancelled) setFallback({ value: raw, decimals: dec });
      } catch {
        if (!cancelled) setFallback({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, token, data?.value, data?.decimals, client]);

  // sensible last-resort decimals if both wagmi & fallback are missing
  const inferredDecimals =
    token?.toLowerCase() === USDC.toLowerCase() ? 6 : 18;

  return {
    value: data?.value ?? fallback.value,
    decimals: data?.decimals ?? fallback.decimals ?? inferredDecimals,
    isLoading: isFetching,
    error,
    refetch,
  };
}
