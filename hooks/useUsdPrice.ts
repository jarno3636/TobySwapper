// hooks/useUsdPrice.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { Address, createPublicClient, erc20Abi, http, parseUnits } from "viem";
import { base } from "viem/chains";
import { usePublicClient } from "wagmi";
import * as ADDR from "@/lib/addresses";

/** Minimal UniV2-style router ABI for quoting */
const UniV2RouterAbi = [
  {
    type: "function",
    name: "getAmountsOut",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

// Base WETH
const WETH: Address = "0x4200000000000000000000000000000000000006";

/** Resolve addresses flexibly so missing exports don't break types/builds */
function resolveAddresses() {
  const USDC =
    (ADDR as any).USDC ??
    (process.env.NEXT_PUBLIC_USDC as Address) ??
    ("0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913" as Address); // Base USDC

  const ROUTER =
    (ADDR as any).ROUTER ??
    (ADDR as any).SWAPPER ?? // if you prefer to route via your own swapper (must expose getAmountsOut)
    (process.env.NEXT_PUBLIC_V2_ROUTER as Address);

  return { USDC: USDC as Address, ROUTER: ROUTER as Address | undefined };
}

/** Safely get a viem client (wagmi public client if present, else a fallback) */
function useSafePublicClient() {
  const wagmiClient = usePublicClient(); // may be undefined during build/type-check
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_BASE ||
    (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
      ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
      : undefined);

  // Fallback viem client so we never end up with an undefined client
  const fallback = useMemo(
    () =>
      createPublicClient({
        chain: base,
        transport: http(rpcUrl || "https://mainnet.base.org"),
      }),
    [rpcUrl]
  );

  return wagmiClient ?? fallback;
}

/**
 * Get USD price for a token (ETH or ERC20) by routing to USDC on-chain.
 * Returns a number (0 if no quote).
 */
export function useUsdPriceSingle(idOrAddr: "ETH" | Address) {
  const client = useSafePublicClient();
  const [price, setPrice] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { USDC, ROUTER } = resolveAddresses();
        if (!ROUTER) {
          // No router configured; fail soft to 0 instead of crashing build
          if (!cancelled) setPrice(0);
          return;
        }

        // ETH path: WETH -> USDC
        if (idOrAddr === "ETH") {
          const amountIn = parseUnits("1", 18);
          const amounts = (await client.readContract({
            address: ROUTER,
            abi: UniV2RouterAbi as any,
            functionName: "getAmountsOut",
            args: [amountIn, [WETH, USDC]],
          })) as bigint[];

          const out = amounts[amounts.length - 1];
          const p = Number(out) / 1e6; // USDC has 6 decimals on Base
          if (!cancelled) setPrice(Number.isFinite(p) ? p : 0);
          return;
        }

        // ERC20 path: token -> USDC
        const [decimals, usdcDecimals] = await Promise.all([
          client.readContract({
            address: idOrAddr as Address,
            abi: erc20Abi,
            functionName: "decimals",
          }) as Promise<number>,
          client.readContract({
            address: USDC,
            abi: erc20Abi,
            functionName: "decimals",
          }) as Promise<number>,
        ]);

        const amountIn = parseUnits("1", decimals);
        const amounts = (await client.readContract({
          address: ROUTER,
          abi: UniV2RouterAbi as any,
          functionName: "getAmountsOut",
          args: [amountIn, [idOrAddr as Address, USDC]],
        })) as bigint[];

        const out = amounts[amounts.length - 1];
        const p = Number(out) / 10 ** usdcDecimals;
        if (!cancelled) setPrice(Number.isFinite(p) ? p : 0);
      } catch {
        if (!cancelled) setPrice(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, idOrAddr]);

  return price;
}
