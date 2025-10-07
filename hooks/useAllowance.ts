"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Address, erc20Abi, maxUint256 } from "viem";
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

  const approveOnce = useCallback(
    async (amount: bigint) => {
      if (!token || !spender) throw new Error("Missing token or spender");
      const tx = await writeContractAsync({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, amount] as const,
      });
      // wait for this approval to mine
      await new Promise<void>((resolve, reject) => {
        const unsub = wait.refetch().then(() => resolve()).catch(reject);
        // we can rely on wagmi's internal tracking via `hash`, so no manual unsub needed
        return unsub;
      });
      return tx;
    },
    [token, spender, writeContractAsync, wait]
  );

  /**
   * Robust “set max allowance” flow:
   * - If current allowance > 0 and target is max, some tokens require approve(0) first.
   * - Then approve(max).
   */
  const approveMaxFlow = useCallback(
    async (current?: bigint) => {
      if (!token || !spender) throw new Error("Missing token or spender");
      // step 1: if current > 0, reset to 0 first
      if (current && current > 0n) {
        await approveOnce(0n);
      }
      // step 2: set max
      await approveOnce(maxUint256);
    },
    [token, spender, approveOnce]
  );

  return { approveOnce, approveMaxFlow, txHash: hash, isPending, wait, owner };
}
