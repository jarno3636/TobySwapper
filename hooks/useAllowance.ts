// hooks/useAllowance.ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Address, erc20Abi, maxUint256 } from "viem";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";

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

export function useApprove(token?: Address, spender?: Address) {
  const { writeContractAsync, data: writeHash, isPending: isWritePending } = useWriteContract();
  const { isLoading: isWaiting } = useWaitForTransactionReceipt({ hash: writeHash });

  const approveMaxFlow = useCallback(
    async (currentAllowance?: bigint) => {
      if (!token || !spender) throw new Error("Missing token/spender");
      if (currentAllowance && currentAllowance > 0n) {
        await writeContractAsync({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, 0n] });
        // small pause; Base confirms fast
        await new Promise((r) => setTimeout(r, 1200));
      }
      return writeContractAsync({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, maxUint256] });
    },
    [token, spender, writeContractAsync]
  );

  return { approveMaxFlow, isPending: isWritePending || isWaiting, txHash: writeHash };
}
