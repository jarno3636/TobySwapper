"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { erc20Abi } from "viem";
import { useBalance, usePublicClient } from "wagmi";
import { TOKENS, USDC, NATIVE_ETH, TokenAddress, isNative } from "@/lib/addresses";

function knownDecimals(token?: TokenAddress) {
  if (!token || isNative(token)) return 18;
  if ((token as Address).toLowerCase() === USDC.toLowerCase()) return 6;
  const hit = TOKENS.find((t) => t.address !== NATIVE_ETH && (t.address as Address).toLowerCase() === (token as Address).toLowerCase());
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
  token?: TokenAddress,
  opts?: { chainId?: number }
): UseTokenBalanceResult {
  const chainId = opts?.chainId ?? 8453;
  const client = usePublicClient({ chainId });

  const userLC = lc(user);
  const tokenKey = isNative(token) ? "native" : (token as Address | undefined)?.toLowerCase();

  const scopeKey = useMemo(
    () => `bal-${chainId}-${(userLC ?? "0x")}-${(tokenKey ?? "native")}`,
    [userLC, tokenKey, chainId]
  );

  const {
    data,
    isFetching,
    refetch,
    error,
  } = useBalance({
    address: userLC,
    token: isNative(token) ? undefined : ((token as Address | undefined) ?? undefined),
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
        if (isNative(token) || !token) {
          const raw = await client.getBalance({ address: userLC });
          if (!cancelled) setFallback({ value: raw, decimals: 18 });
        } else {
          const tokenAddr = token as Address;
          const [raw, dec] = await Promise.all([
            client.readContract({
              address: tokenAddr,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [userLC],
            }) as Promise<bigint>,
            client.readContract({
              address: tokenAddr,
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
  }, [client, userLC, tokenKey, chainId, data?.value, data?.decimals, scopeKey, token]);

  const decimals = data?.decimals ?? fallback.decimals ?? knownDecimals(token);

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
