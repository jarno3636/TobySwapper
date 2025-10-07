// hooks/useTobySwapper.ts
"use client";

import { useCallback } from "react";
import { Address, parseUnits } from "viem";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import TobySwapperAbi from "@/abi/TobySwapper.json";
import { SWAPPER, WETH, TOBY, TOKENS } from "@/lib/addresses";

/** Resolve decimals from your TOKENS list; default 18 if unknown */
const getDecimals = (addr: Address) =>
  TOKENS.find((t) => t.address.toLowerCase() === addr.toLowerCase())?.decimals ?? 18;

export type SwapPaths = {
  pathForMainSwap: Address[];
  pathForFeeSwap: Address[];
  isIdentity: boolean; // tokenIn (normalized) == tokenOut (no hop)
};

/**
 * Build paths for main swap & fee swap.
 * - Normalizes ETH -> WETH for routing.
 * - Ensures each path has length ≥ 2 (some routers choke on single-hop identity).
 * - Flags identity routes so UI/caller can short-circuit quotes if desired.
 */
export function buildPaths(tokenIn: Address | "ETH", tokenOut: Address): SwapPaths {
  const inAddr = tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address);

  // Identity detection
  const isIdentity = inAddr.toLowerCase() === tokenOut.toLowerCase();

  // Fee path: convert fee to TOBY. Always length ≥ 2.
  const pathForFeeSwap =
    inAddr.toLowerCase() === TOBY.toLowerCase()
      ? [inAddr as Address, TOBY as Address]
      : inAddr.toLowerCase() === WETH.toLowerCase()
      ? [WETH as Address, TOBY as Address]
      : [inAddr as Address, WETH as Address, TOBY as Address];

  // Main path (length ≥ 2)
  let pathForMainSwap: Address[];
  if (isIdentity) {
    // Router-safe identity (still 2 addresses)
    pathForMainSwap = [inAddr, tokenOut];
  } else if (tokenIn === "ETH") {
    pathForMainSwap =
      tokenOut.toLowerCase() === WETH.toLowerCase()
        ? [WETH as Address, WETH as Address] // ETH→WETH (1:1 but length 2)
        : [WETH as Address, tokenOut];
  } else if (
    inAddr.toLowerCase() === WETH.toLowerCase() ||
    tokenOut.toLowerCase() === WETH.toLowerCase()
  ) {
    pathForMainSwap = [inAddr, tokenOut];
  } else {
    pathForMainSwap = [inAddr, WETH as Address, tokenOut];
  }

  return { pathForMainSwap, pathForFeeSwap, isIdentity };
}

export function useDoSwap() {
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const wait = useWaitForTransactionReceipt({ hash });

  /**
   * Token -> Token
   * amountInHuman: human units of tokenIn
   * minOutMainHuman: human units of tokenOut (‼️ parsed with tokenOut decimals)
   * minOutFeeHuman: human units in TOBY (assumed 18)
   */
  const swapTokensForTokens = useCallback(
    async (
      tokenIn: Address,
      tokenOut: Address,
      amountInHuman: string,
      minOutMainHuman: string,
      minOutFeeHuman: string
    ) => {
      const { pathForMainSwap, pathForFeeSwap } = buildPaths(tokenIn, tokenOut);
      const decIn = getDecimals(tokenIn);
      const decOut = getDecimals(tokenOut);

      const args = [
        tokenIn,
        tokenOut,
        parseUnits(amountInHuman || "0", decIn),    // amountIn: tokenIn decimals
        parseUnits(minOutMainHuman || "0", decOut), // minOutMain: tokenOut decimals ✅
        pathForMainSwap,
        pathForFeeSwap,
        parseUnits(minOutFeeHuman || "0", 18),      // minOutFee: TOBY(18)
        BigInt(Math.floor(Date.now() / 1000) + 60 * 10),
      ] as const;

      return writeContractAsync({
        address: SWAPPER,
        abi: TobySwapperAbi as any,
        functionName: "swapTokensForTokensSupportingFeeOnTransferTokens",
        args,
      });
    },
    [writeContractAsync]
  );

  /**
   * ETH -> Token
   * ethInHuman: human ETH
   * minOutMainHuman: human units of tokenOut (‼️ parsed with tokenOut decimals)
   * minOutFeeHuman: human TOBY (18)
   */
  const swapETHForTokens = useCallback(
    async (
      tokenOut: Address,
      ethInHuman: string,
      minOutMainHuman: string,
      minOutFeeHuman: string
    ) => {
      const { pathForMainSwap, pathForFeeSwap } = buildPaths("ETH", tokenOut);
      const decOut = getDecimals(tokenOut);

      const args = [
        tokenOut,
        parseUnits(minOutMainHuman || "0", decOut), // minOutMain: tokenOut decimals ✅
        pathForMainSwap,
        pathForFeeSwap,
        parseUnits(minOutFeeHuman || "0", 18),      // minOutFee: TOBY(18)
        BigInt(Math.floor(Date.now() / 1000) + 60 * 10),
      ] as const;

      return writeContractAsync({
        address: SWAPPER,
        abi: TobySwapperAbi as any,
        functionName: "swapETHForTokensSupportingFeeOnTransferTokens",
        args,
        value: parseUnits(ethInHuman || "0", 18),
      });
    },
    [writeContractAsync]
  );

  return { swapTokensForTokens, swapETHForTokens, txHash: hash, isPending, wait };
}
