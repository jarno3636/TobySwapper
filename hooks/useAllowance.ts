// hooks/useAllowance.ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Address, erc20Abi } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";

type StickyAllowance = {
  value?: bigint;      // last good raw allowance
  isLoading: boolean;
  refetch: () => void;
};

export function useStickyAllowance(
  token?: Address,
  owner?: Address,
  spender?: Address
): StickyAllowance {
  const enabled = Boolean(token && owner && spender);

  const { data, refetch, isFetching } = useReadContract({
    address: enabled ? (token as Address) : undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: enabled ? ([owner as Address, spender as Address] as const) : undefined,
    query: {
      enabled,
      refetchInterval: 10_000,
      staleTime: 8_000,
      refetchOnWindowFocus: false,
      retry: 2,
      // Explicit param type to satisfy TS under isolatedModules
      placeholderData: (prev: unknown) => prev,
    },
  } as any);

  // stick to last known good bigint
  const lastGood = useRef<bigint | undefined>(undefined);
  const [value, setValue] = useState<bigint | undefined>(undefined);

  useEffect(() => {
    if (typeof data === "bigint") {
      lastGood.current = data;
      setValue(data);
    } else if (lastGood.current !== undefined) {
      setValue(lastGood.current);
    }
  }, [data]);

  return { value, isLoading: isFetching, refetch };
}

export function useApprove(token?: Address, spender?: Address) {
  const { address: owner } = useAccount();
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const wait = useWaitForTransactionReceipt({ hash });

  const approve = useCallback(
    async (amount: bigint) => {
      if (!token || !spender) throw new Error("Missing token or spender");
      return writeContractAsync({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, amount] as const,
      });
    },
    [token, spender, writeContractAsync]
  );

  return { approve, txHash: hash, isPending, wait, owner };
}
