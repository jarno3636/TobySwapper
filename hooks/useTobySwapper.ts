// hooks/useTobySwapper.ts
"use client";

import { useCallback } from "react";
import { Address, parseUnits } from "viem";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import TobySwapperAbi from "@/abi/TobySwapper.json";
import { SWAPPER, WETH, TOBY, TOKENS } from "@/lib/addresses";

const getDecimals = (addr: Address) =>
  TOKENS.find((t) => t.address.toLowerCase() === addr.toLowerCase())?.decimals ?? 18;

const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export type SwapPaths = {
  pathForMainSwap: Address[];
  pathForFeeSwap: Address[];
  isIdentity: boolean;
};

export function buildPaths(tokenIn: Address | "ETH", tokenOut: Address): SwapPaths {
  const inAddr = tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address);
  const isIdentity = eq(inAddr, tokenOut);

  const pathForFeeSwap = eq(inAddr, TOBY)
    ? [inAddr, TOBY as Address]
    : eq(inAddr, WETH)
    ? [WETH as Address, TOBY as Address]
    : [inAddr, WETH as Address, TOBY as Address];

  let pathForMainSwap: Address[];
  if (isIdentity) pathForMainSwap = [inAddr, tokenOut];
  else if (tokenIn === "ETH")
    pathForMainSwap = eq(tokenOut, WETH) ? [WETH as Address, WETH as Address] : [WETH as Address, tokenOut];
  else if (eq(inAddr, WETH) || eq(tokenOut, WETH))
    pathForMainSwap = [inAddr, tokenOut];
  else pathForMainSwap = [inAddr, WETH as Address, tokenOut];

  return { pathForMainSwap, pathForFeeSwap, isIdentity };
}

export function useDoSwap() {
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const wait = useWaitForTransactionReceipt({ hash });

  const swapTokensForTokens = useCallback(
    async (tokenIn: Address, tokenOut: Address, amountInHuman: string, minOutMainHuman: string, minOutFeeHuman: string) => {
      const { pathForMainSwap, pathForFeeSwap } = buildPaths(tokenIn, tokenOut);
      const decIn = getDecimals(tokenIn);
      const decOut = getDecimals(tokenOut);

      return writeContractAsync({
        address: SWAPPER,
        abi: TobySwapperAbi as any,
        functionName: "swapTokensForTokensSupportingFeeOnTransferTokens",
        args: [
          tokenIn,
          tokenOut,
          parseUnits(amountInHuman || "0", decIn),
          parseUnits(minOutMainHuman || "0", decOut),
          pathForMainSwap,
          pathForFeeSwap,
          parseUnits(minOutFeeHuman || "0", 18),
          BigInt(Math.floor(Date.now() / 1000) + 60 * 10),
        ],
      });
    },
    [writeContractAsync]
  );

  const swapETHForTokens = useCallback(
    async (tokenOut: Address, ethInHuman: string, minOutMainHuman: string, minOutFeeHuman: string) => {
      const { pathForMainSwap, pathForFeeSwap } = buildPaths("ETH", tokenOut);
      const decOut = getDecimals(tokenOut);

      return writeContractAsync({
        address: SWAPPER,
        abi: TobySwapperAbi as any,
        functionName: "swapETHForTokensSupportingFeeOnTransferTokens",
        args: [
          tokenOut,
          parseUnits(minOutMainHuman || "0", decOut),
          pathForMainSwap,
          pathForFeeSwap,
          parseUnits(minOutFeeHuman || "0", 18),
          BigInt(Math.floor(Date.now() / 1000) + 60 * 10),
        ],
        value: parseUnits(ethInHuman || "0", 18),
      });
    },
    [writeContractAsync]
  );

  return { swapTokensForTokens, swapETHForTokens, txHash: hash, isPending, wait };
}
