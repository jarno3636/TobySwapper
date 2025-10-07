// hooks/useTokenBalance.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { erc20Abi } from "viem";
import { base } from "viem/chains";
import { useBalance, usePublicClient } from "wagmi";

/**
 * Returns a reliable balance for native or ERC-20 on Base:
 * 1) Try wagmi useBalance (fast + cached)
 * 2) Fallback to direct viem reads:
 *    - Native: client.getBalance
 *    - ERC-20: balanceOf + decimals
 *
 * Also fixes:
 *  - Scope key includes user+token (no cross-sticky)
 *  - Native ETH fallback path (previously missing)
 *  - Reset-safe and refetches on token/address change
 */
export function useTokenBalance(user?: Address, token?: Address) {
  const client = usePublicClient({ chainId: base.id });

  // Stronger cache key (per user+token)
  const scopeKey = useMemo(
    () => `bal-${(user ?? "0x").toLowerCase()}-${(token ?? "native").toLowerCase()}`,
    [user, token]
  );

  const {
    data,          // { value, decimals, symbol }
    isFetching,
    refetch,
    error,
  } = useBalance({
    address: user,
    token,
    chainId: base.id,
    scopeKey,
    query: {
      enabled: Boolean(user),
      refetchInterval: 15_000,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      placeholderData: (prev: any) => prev,
      retry: 2,
    },
  });

  const [fallback, setFallback] = useState<{ value?: bigint; decimals?: number }>({});

  // Fallback for BOTH native and ERC-20
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user) return;

      // If wagmi already has both pieces, prefer it
      if (data?.value !== undefined && data?.decimals !== undefined) {
        if (!cancelled) setFallback({});
        return;
      }

      if (!client) return;

      try {
        if (!token) {
          // Native (ETH on Base)
          const [raw] = await Promise.all([
            client.getBalance({ address: user }),
          ]);
          if (!cancelled) setFallback({ value: raw, decimals: 18 });
        } else {
          // ERC-20
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
        }
      } catch {
        if (!cancelled) setFallback({});
      }
    })();

    return () => { cancelled = true; };
  }, [client, user, token, data?.value, data?.decimals, scopeKey]);

  // Final output with reasonable default decimals if absolutely necessary
  const decimals =
    data?.decimals ??
    fallback.decimals ??
    (token ? 18 : 18); // (your listed tokens are 18; USDC is handled elsewhere in UI)

  return {
    value: data?.value ?? fallback.value,
    decimals,
    isLoading: isFetching,
    error,
    refetch,
  };
}
