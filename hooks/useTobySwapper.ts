// hooks/useTobySwapper.ts
"use client";
import { useCallback, useMemo } from "react";
import { Address, parseUnits } from "viem";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import TobySwapperAbi from "@/abi/TobySwapper.json";
import { SWAPPER, WETH, TOBY, TOKENS } from "@/lib/addresses";

const getDecimals = (addr: Address) =>
  TOKENS.find(t => t.address.toLowerCase() === addr.toLowerCase())?.decimals ?? 18;

export type SwapPaths = {
  pathForMainSwap: Address[];
  pathForFeeSwap: Address[];
  isIdentity: boolean; // <— NEW
};

export function buildPaths(tokenIn: Address | "ETH", tokenOut: Address): SwapPaths {
  const inAddr = tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address);

  // identity (no hop) detection
  const isIdentity = inAddr.toLowerCase() === tokenOut.toLowerCase();

  // Fee path: fee is converted to TOBY
  const pathForFeeSwap =
    inAddr.toLowerCase() === TOBY.toLowerCase()
      ? [inAddr, TOBY] // keep length ≥2 for router safety
      : inAddr.toLowerCase() === WETH.toLowerCase()
      ? [WETH as Address, TOBY as Address]
      : [inAddr as Address, WETH as Address, TOBY as Address];

  // Main path rules (ensure length ≥2):
  let pathForMainSwap: Address[];
  if (isIdentity) {
    // Router expects ≥2; use [X, X] for a 1:1 quote (we'll special-case in UI too)
    pathForMainSwap = [inAddr, tokenOut];
  } else if (tokenIn === "ETH") {
    pathForMainSwap =
      tokenOut.toLowerCase() === WETH.toLowerCase()
        ? [WETH as Address, WETH as Address] // ETH→WETH 1:1
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
        parseUnits(amountInHuman, decIn),
        parseUnits(minOutMainHuman, decOut), // parse with OUT decimals ✅
        pathForMainSwap,
        pathForFeeSwap,
        parseUnits(minOutFeeHuman, 18), // fee quote uses 18; safe for WETH/TOBY path
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
        parseUnits(minOutMainHuman, decOut), // OUT decimals ✅
        pathForMainSwap,
        pathForFeeSwap,
        parseUnits(minOutFeeHuman, 18),
        BigInt(Math.floor(Date.now() / 1000) + 60 * 10),
      ] as const;

      return writeContractAsync({
        address: SWAPPER,
        abi: TobySwapperAbi as any,
        functionName: "swapETHForTokensSupportingFeeOnTransferTokens",
        args,
        value: parseUnits(ethInHuman, 18),
      });
    },
    [writeContractAsync]
  );

  return { swapTokensForTokens, swapETHForTokens, txHash: hash, isPending, wait };
}
