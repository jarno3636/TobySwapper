// hooks/useTokenBalance.ts
"use client";

import { useEffect, useState } from "react";
import { Address, erc20Abi } from "viem";
import { base } from "viem/chains";
import { useBalance, usePublicClient } from "wagmi";

/**
 * Returns a reliable balance for native or ERC-20:
 * - tries wagmi useBalance first (fast/cache)
 * - falls back to direct ERC20 balanceOf via viem client if needed
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

  // When wagmi has no value for ERC-20, do a direct read
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !token) return;
      // if wagmi worked, use it
      if (data?.value !== undefined && data?.decimals !== undefined) {
        setFallback({});
        return;
      }
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
      } catch (_) {
        if (!cancelled) setFallback({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, token, data?.value, data?.decimals, client]);

  return {
    value: data?.value ?? fallback.value,
    decimals:
      data?.decimals ??
      fallback.decimals ??
      (token ? 6 : 18), // last resort (USDC=6, native=18)
    isLoading: isFetching,
    error,
    refetch,
  };
}
