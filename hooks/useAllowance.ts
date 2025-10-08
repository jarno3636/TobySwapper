"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Address, erc20Abi, maxUint256 } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";

/** Sticky, low-churn allowance reader */
export function useStickyAllowance(
  token?: Address,
  owner?: Address,
  spender?: Address
) {
  const enabled = Boolean(token && owner && spender);

  const { data, refetch, isFetching, error } = useReadContract({
    address: enabled ? token : undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: enabled ? ([owner as Address, spender as Address] as const) : undefined,
    query: {
      enabled,
      refetchInterval: 10_000,
      staleTime: 8_000,
      refetchOnWindowFocus: false,
      retry: 2,
      placeholderData: (prev: unknown) => prev,
    },
  } as any);

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

  return { value, isLoading: isFetching, error, refetch };
}

/** Robust “max” approve flow (zero first if nonzero, then set max) */
export function useApprove(token?: Address, spender?: Address) {
  const { writeContractAsync, data: writeHash, isPending: isWritePending } = useWriteContract();
  const { isLoading: isWaiting } = useWaitForTransactionReceipt({ hash: writeHash });

  const approveMaxFlow = useCallback(
    async (currentAllowance?: bigint) => {
      if (!token || !spender) throw new Error("Missing token/spender");
      if (currentAllowance && currentAllowance > 0n) {
        const tx0 = await writeContractAsync({
          address: token,
          abi: erc20Abi,
          functionName: "approve",
          args: [spender, 0n],
        });
        // Wait via wallet UI or an explicit small delay; basescan confirms fast on Base.
        await new Promise((r) => setTimeout(r, 1200));
      }
      const tx1 = await writeContractAsync({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, maxUint256],
      });
      return tx1;
    },
    [token, spender, writeContractAsync]
  );

  return { approveMaxFlow, isPending: isWritePending || isWaiting, txHash: writeHash };
}
