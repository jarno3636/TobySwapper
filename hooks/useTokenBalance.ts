// hooks/useTokenBalance.ts
"use client";

import { useBalance, usePublicClient } from "wagmi";
import { Address, erc20Abi } from "viem";
import { base } from "viem/chains";
import { useEffect, useState } from "react";

export function useTokenBalance(address?: Address, token?: Address) {
  const client = usePublicClient({ chainId: base.id });
  const { data, refetch, isFetching, error } = useBalance({
    address,
    token,
    chainId: base.id,
    query: {
      enabled: Boolean(address && base.id),
      refetchInterval: 15_000,
      staleTime: 10_000,
    },
    scopeKey: token ? `balance-${token}` : "balance-native",
  });

  const [fallbackBal, setFallbackBal] = useState<bigint | undefined>();

  useEffect(() => {
    if (!address || !token) return;
    if (data?.value !== undefined) return; // wagmi worked
    (async () => {
      try {
        const bal = await client.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        });
        setFallbackBal(bal as bigint);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("ERC20 fallback failed", err);
        }
      }
    })();
  }, [address, token, data?.value, client]);

  return {
    value: data?.value ?? fallbackBal,
    decimals: data?.decimals ?? (token ? 6 : 18), // assume USDC if token
    isLoading: isFetching,
    error,
    refetch,
  };
}
