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

const lc = (a?: Address) => (a ? (a.toLowerCase() as Address) : undefined);

export type UseTokenBalanceResult = {
  value?: bigint;
  decimals: number;
  isLoading: boolean;
  error?: unknown;
  refetch: () => void;
  wagmi?: { value?: bigint; decimals?: number };
  fallback?: { value?: bigint; decimals?: number };
};

export function useTokenBalance(
  user?: Address,
  token?: Address,
  opts?: { chainId?: number }
): UseTokenBalanceResult {
  const chainId = opts?.chainId ?? 8453;
  const client = usePublicClient({ chainId });

  const userLC = lc(user);
  const tokenLC = lc(token);

  const scopeKey = useMemo(
    () => `bal-${chainId}-${(userLC ?? "0x")}-${(tokenLC ?? "native")}`,
    [userLC, tokenLC, chainId]
  );

  const {
    data,
    isFetching,
    refetch,
    error,
  } = useBalance({
    address: userLC,
    token: tokenLC,
    chainId,
    scopeKey,
    query: {
      enabled: Boolean(userLC),
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
      if (!userLC || !client) return;

      if (data?.value !== undefined && data?.decimals !== undefined) {
        if (!cancelled) setFallback({});
        return;
      }

      try {
        if (!tokenLC) {
          const raw = await client.getBalance({ address: userLC });
          if (!cancelled) setFallback({ value: raw, decimals: 18 });
        } else {
          const [raw, dec] = await Promise.all([
            client.readContract({
              address: tokenLC,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [userLC],
            }) as Promise<bigint>,
            client.readContract({
              address: tokenLC,
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
  }, [client, userLC, tokenLC, chainId, data?.value, data?.decimals, scopeKey]);

  const decimals = data?.decimals ?? fallback.decimals ?? knownDecimals(tokenLC);

  return {
    value: data?.value ?? fallback.value,
    decimals,
    isLoading: isFetching,
    error,
    refetch,
    wagmi: { value: data?.value, decimals: data?.decimals },
    fallback,
  };
}
