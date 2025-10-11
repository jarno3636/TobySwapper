// hooks/useTokenBalance.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { erc20Abi, getAddress } from "viem";        // 👈 add getAddress
import { useBalance, usePublicClient } from "wagmi";
import { TOKENS, USDC, NATIVE_ETH, TokenAddress, isNative } from "@/lib/addresses";

function knownDecimals(token?: TokenAddress) {
  if (!token || isNative(token)) return 18;
  // compare checksummed to be robust
  try {
    if (getAddress(token as Address) === getAddress(USDC)) return 6;
  } catch {}
  const hit = TOKENS.find((t) => t.address !== NATIVE_ETH && String(t.address).toLowerCase() === String(token).toLowerCase());
  return hit?.decimals ?? 18;
}

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

  // ✅ Normalize everything to checksum once
  const userCS = useMemo(
    () => (user ? getAddress(user as Address) : undefined),
    [user]
  );
  const tokenCS = useMemo(
    () => (isNative(token) || !token ? undefined : getAddress(token as Address)),
    [token]
  );

  const scopeKey = useMemo(
    () => `bal-${chainId}-${(userCS ?? "0x")}-${(tokenCS ?? "native")}`,
    [userCS, tokenCS, chainId]
  );

  const {
    data,
    isFetching,
    refetch,
    error,
  } = useBalance({
    address: userCS,
    token: tokenCS,            // 👈 checksummed
    chainId,
    scopeKey,
    query: {
      enabled: Boolean(userCS),
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
      if (!userCS || !client) return;

      // If wagmi gave us both value & decimals, no fallback needed
      if (data?.value !== undefined && data?.decimals !== undefined) {
        if (!cancelled) setFallback({});
        return;
      }

      try {
        if (!tokenCS) {
          // native ETH
          const raw = await client.getBalance({ address: userCS });
          if (!cancelled) setFallback({ value: raw, decimals: 18 });
        } else {
          // ERC-20
          const [raw, dec] = await Promise.all([
            client.readContract({
              address: tokenCS,        // 👈 checksummed
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [userCS],
            }) as Promise<bigint>,
            client.readContract({
              address: tokenCS,        // 👈 checksummed
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
  }, [client, userCS, tokenCS, chainId, data?.value, data?.decimals, scopeKey]);

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
