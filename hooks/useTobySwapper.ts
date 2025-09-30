"use client";
import { useCallback, useMemo } from "react";
import { Address, encodeFunctionData, parseUnits } from "viem";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import TobySwapperAbi from "@/abi/TobySwapper.json";
import { SWAPPER, WETH, TOBY } from "@/lib/addresses";

export function useSwapperConfig() {
  const feeBps = useReadContract({ address: SWAPPER, abi: TobySwapperAbi as any, functionName: "feeBps" });
  const burn = useReadContract({ address: SWAPPER, abi: TobySwapperAbi as any, functionName: "burnAddress" });
  const toby = useReadContract({ address: SWAPPER, abi: TobySwapperAbi as any, functionName: "TOBY" });
  return { feeBps, burn, toby };
}

export function useSwapWrite() {
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const wait = useWaitForTransactionReceipt({ hash });
  return { writeContractAsync, txHash: hash, isPending, wait };
}

export type SwapPaths = {
  pathForMainSwap: Address[];
  pathForFeeSwap: Address[];
};

export function buildPaths(tokenIn: Address | "ETH", tokenOut: Address): SwapPaths {
  // Fee is converted to TOBY; take the fee path from tokenIn (or WETH if ETH) → WETH → TOBY
  const inAddr = tokenIn === "ETH" ? (WETH as Address) : (tokenIn as Address);
  const pathForFeeSwap = inAddr.toLowerCase() === TOBY.toLowerCase()
    ? [inAddr as Address]
    : (inAddr.toLowerCase() === (WETH as Address).toLowerCase() ? [inAddr, TOBY as Address] : [inAddr, WETH as Address, TOBY as Address]);

  // Main path: prefer direct route; otherwise hop via WETH
  const pathForMainSwap = tokenIn === "ETH"
    ? ((tokenOut.toLowerCase() === (WETH as Address).toLowerCase()) ? [WETH as Address] : [WETH as Address, tokenOut])
    : ((tokenIn as Address).toLowerCase() === (WETH as Address).toLowerCase() || tokenOut.toLowerCase() === (WETH as Address).toLowerCase()
        ? [tokenIn as Address, tokenOut]
        : [tokenIn as Address, WETH as Address, tokenOut]);

  return { pathForMainSwap, pathForFeeSwap };
}

export function useDoSwap() {
  const { address } = useAccount();
  const { writeContractAsync } = useSwapWrite();

  const swapTokensForTokens = useCallback(async (
    tokenIn: Address,
    tokenOut: Address,
    amountIn: string, // human
    minOutMain: string, // human
    minOutFee: string, // human
  ) => {
    const { pathForMainSwap, pathForFeeSwap } = buildPaths(tokenIn, tokenOut);
    const decimalsIn = 18; // Assume 18 except USDC handled by caller
    const args = [
      tokenIn,
      tokenOut,
      parseUnits(amountIn, decimalsIn),
      parseUnits(minOutMain, decimalsIn),
      pathForMainSwap,
      pathForFeeSwap,
      parseUnits(minOutFee, 18),
      BigInt(Math.floor(Date.now()/1000) + 60*10),
    ] as const;
    return writeContractAsync({ address: SWAPPER, abi: TobySwapperAbi as any, functionName: "swapTokensForTokensSupportingFeeOnTransferTokens", args });
  }, [writeContractAsync]);

  const swapETHForTokens = useCallback(async (
    tokenOut: Address,
    ethIn: string, // human ETH
    minOutMain: string, // human
    minOutFee: string, // human
  ) => {
    const { pathForMainSwap, pathForFeeSwap } = buildPaths("ETH", tokenOut);
    const args = [
      tokenOut,
      parseUnits(minOutMain, 18),
      pathForMainSwap,
      pathForFeeSwap,
      parseUnits(minOutFee, 18),
      BigInt(Math.floor(Date.now()/1000) + 60*10),
    ] as const;
    return writeContractAsync({ address: SWAPPER, abi: TobySwapperAbi as any, functionName: "swapETHForTokensSupportingFeeOnTransferTokens", args, value: parseUnits(ethIn, 18) });
  }, [writeContractAsync]);

  return { address, swapTokensForTokens, swapETHForTokens };
}
