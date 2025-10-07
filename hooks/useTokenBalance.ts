// hooks/useTokenBalance.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { erc20Abi } from "viem";
import { useBalance, usePublicClient } from "wagmi";
import { TOKENS, USDC } from "@/lib/addresses";

function knownDecimals(token?: Address) {
  if (!token) return 18;
  if (token.toLowerCase() === USDC.toLowerCase()) return 6;
  const hit = TOKENS.find((t) => t.address.toLowerCase() === token.toLowerCase());
  return hit?.decimals ?? 18;
}

export type UseTokenBalanceResult = {
  // unified
  value?: bigint;
  decimals: number;
  isLoading: boolean;
  error?: unknown;
  refetch: () => void;

  // diagnostics
  wagmi?: { value?: bigint; decimals?: number };
  fallback?: { value?: bigint; decimals?: number };
};

export function useTokenBalance(
  user?: Address,
  token?: Address,
  opts?: { chainId?: number } // allow explicit chainId
): UseTokenBalanceResult {
  const chainId = opts?.chainId ?? 8453; // Base by default
  const client = usePublicClient({ chainId });

  const scopeKey = useMemo(
    () =>
      `bal-${chainId}-${(user ?? "0x").toLowerCase()}-${(token ?? "native").toLowerCase()}`,
    [user, token, chainId]
  );

  const {
    data,
    isFetching,
    refetch,
    error,
  } = useBalance({
    address: user,
    token,
    chainId,
    scopeKey,
    query: {
      enabled: Boolean(user),
      refetchInterval: 15_000,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      retry: 2,
      placeholderData: (prev: any) => prev,
    },
  });

  const [fallback, setFallback] = useState<{ value?: bigint; decimals?: number }>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !client) return;

      // If wagmi already delivered both fields, we can skip fallback
      if (data?.value !== undefined && data?.decimals !== undefined) {
        if (!cancelled) setFallback({});
        return;
      }

      try {
        if (!token) {
          const raw = await client.getBalance({ address: user });
          if (!cancelled) setFallback({ value: raw, decimals: 18 });
        } else {
          const [raw, dec] = await Promise.all([
            client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [user] }) as Promise<bigint>,
            client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }) as Promise<number>,
          ]);
          if (!cancelled) setFallback({ value: raw, decimals: dec });
        }
      } catch (e) {
        if (!cancelled) setFallback({});
      }
    })();
    return () => { cancelled = true; };
    // include data fields so we stop falling back once wagmi has them
  }, [client, user, token, chainId, data?.value, data?.decimals, scopeKey]);

  const finalDecimals =
    data?.decimals ??
    fallback.decimals ??
    knownDecimals(token);

  return {
    value: data?.value ?? fallback.value,
    decimals: finalDecimals,
    isLoading: isFetching,
    error,
    refetch,
    wagmi: { value: data?.value, decimals: data?.decimals },
    fallback,
  };
}
