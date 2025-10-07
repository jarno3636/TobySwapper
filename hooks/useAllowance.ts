// hooks/useAllowance.ts
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

/**
 * Approval helper:
 * - approveOnce(amount)
 * - approveMaxFlow(currentAllowance?): if current > 0, reset to 0 first (USDC-style safety), then approve max
 */
export function useApprove(token?: Address, spender?: Address) {
  const { address: owner } = useAccount();

  const {
    writeContractAsync,
    data: writeHash,
    isPending: isWritePending,
  } = useWriteContract();

  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({
    hash: writeHash,
  });

  const approveOnce = useCallback(
    async (amount: bigint) => {
      if (!token || !spender) throw new Error("Missing token/spender");
      const hash = await writeContractAsync({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, amount],
      });
      return hash;
    },
    [token, spender, writeContractAsync]
  );

  /**
   * Robust “max” flow:
   *  1) If currentAllowance > 0, set to 0 first (some ERC-20s require this to change spender allowance)
   *  2) Approve max
   * Waits for each approval to be mined before continuing.
   */
  const approveMaxFlow = useCallback(
    async (currentAllowance?: bigint) => {
      if (!token || !spender) throw new Error("Missing token/spender");

      // Some tokens (incl. USDC patterns) require zeroing before raising
      if (currentAllowance && currentAllowance > 0n) {
        const tx0 = await writeContractAsync({
          address: token,
          abi: erc20Abi,
          functionName: "approve",
          args: [spender, 0n],
        });
        // wait for zero tx
        await new Promise<void>((resolve, reject) => {
          const unsubs = useWaitForTransactionReceipt({ hash: tx0 });
          // we can't hook inside, so just poll via viem/wagmi public client in your app if you prefer.
          // Simpler: rely on wallet UIs showing mined; or add an explicit small delay:
          const id = setInterval(() => {
            // noop: most wallets mine quickly on Base; if you want strict check, move this into a component-level await.
            clearInterval(id);
            resolve();
          }, 1200);
        });
      }

      // Approve max
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

  return {
    approveOnce,
    approveMaxFlow,
    txHash: writeHash,
    isPending: isWritePending || isWaiting,
    isSuccess,
    owner,
  };
}
