"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Address, erc20Abi, maxUint256 } from "viem";
import {
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { TokenAddress, isNative, USDC } from "@/lib/addresses";

/** Sticky reader that avoids UI flicker while queries revalidate. */
export function useStickyAllowance(
  token?: TokenAddress,
  owner?: Address,
  spender?: Address
) {
  if (isNative(token)) {
    return {
      value: undefined as bigint | undefined,
      isLoading: false,
      error: undefined as unknown,
      refetch: async () => ({ data: undefined }),
    };
  }

  const enabled = Boolean(token && owner && spender);

  const { data, refetch, isFetching, error } = useReadContract({
    address: enabled ? (token as Address) : undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: enabled ? ([owner as Address, spender as Address] as const) : undefined,
    query: {
      enabled,
      refetchInterval: false,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: 1,
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
 * Approval flow with receipt confirmation.
 *
 * USDC gets an exact-spend approval by default instead of an unlimited approval.
 * This keeps the allowance aligned to the amount the user is about to spend.
 * Other tokens retain a max-approval option for lower-friction repeat swaps.
 */
export function useApprove(token?: TokenAddress, spender?: Address) {
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const publicClient = usePublicClient();
  const [isWaiting, setIsWaiting] = useState(false);

  const sendAndWait = useCallback(async (amount: bigint) => {
    if (!token || !spender || isNative(token)) throw new Error("Missing ERC-20 token/spender");
    setIsWaiting(true);
    try {
      const hash = await writeContractAsync({
        address: token as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, amount],
      });
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("Approval transaction reverted");
      }
      return hash;
    } finally {
      setIsWaiting(false);
    }
  }, [token, spender, writeContractAsync, publicClient]);

  const approveAmountFlow = useCallback(async (requiredAmount: bigint, currentAllowance?: bigint) => {
    if (!token || !spender) throw new Error("Missing token/spender");
    if (isNative(token)) throw new Error("ETH (native) does not support approvals");
    if (requiredAmount <= 0n) throw new Error("Enter an amount before approving");
    if ((currentAllowance ?? 0n) >= requiredAmount) return undefined;

    const exactForUsdc = String(token).toLowerCase() === String(USDC).toLowerCase();
    const target = exactForUsdc ? requiredAmount : maxUint256;

    try {
      return await sendAndWait(target);
    } catch (firstError) {
      // Some ERC-20s require a zero reset before changing a non-zero allowance.
      if ((currentAllowance ?? 0n) > 0n) {
        await sendAndWait(0n);
        return await sendAndWait(target);
      }
      throw firstError;
    }
  }, [token, spender, sendAndWait]);

  return {
    approveAmountFlow,
    isPending: isWritePending || isWaiting,
  };
}
