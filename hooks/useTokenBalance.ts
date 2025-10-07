// hooks/useTokenBalance.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { erc20Abi } from "viem";
import { base } from "viem/chains";
import { useBalance, usePublicClient } from "wagmi";
import { TOKENS, USDC } from "@/lib/addresses";

/** Look up known decimals from your TOKENS list (falls back to 18, USDC=6) */
function knownDecimals(token?: Address) {
  if (!token) return 18;
  if (token.toLowerCase() === USDC.toLowerCase()) return 6;
  const hit = TOKENS.find((t) => t.address.toLowerCase() === token.toLowerCase());
  return hit?.decimals ?? 18;
}

/**
 * Reliable balance for native or ERC-20 on Base:
 * 1) wagmi useBalance (fast cached)
 * 2) Fallback to viem:
 *    - Native: getBalance
 *    - ERC20: balanceOf + decimals
 * Strong per-user+token scopeKey prevents cross-bleed.
 */
export function useTokenBalance(user?: Address, token?: Address) {
  const client = usePublicClient({ chainId: base.id });

  const scopeKey = useMemo(
    () => `bal-${(user ?? "0x").toLowerCase()}-${(token ?? "native").toLowerCase()}`,
    [user, token]
  );

  const {
    data,
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
      retry: 2,
      placeholderData: (prev: any) => prev,
    },
  });

  const [fallback, setFallback] = useState<{ value?: bigint; decimals?: number }>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;

      // prefer wagmi result when complete
      if (data?.value !== undefined && data?.decimals !== undefined) {
        if (!cancelled) setFallback({});
        return;
      }
      if (!client) return;

      try {
        if (!token) {
          // native ETH on Base
          const raw = await client.getBalance({ address: user });
          if (!cancelled) setFallback({ value: raw, decimals: 18 });
        } else {
          const [raw, dec] = await Promise.all([
            client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [user] }) as Promise<bigint>,
            client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }) as Promise<number>,
          ]);
          if (!cancelled) setFallback({ value: raw, decimals: dec });
        }
      } catch {
        if (!cancelled) setFallback({});
      }
    })();
    return () => { cancelled = true; };
  }, [client, user, token, data?.value, data?.decimals, scopeKey]);

  const decimals =
    data?.decimals ??
    fallback.decimals ??
    knownDecimals(token);

  return {
    value: data?.value ?? fallback.value,
    decimals,
    isLoading: isFetching,
    error,
    refetch,
  };
}
