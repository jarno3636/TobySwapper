// hooks/useUsdPrice.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { Address, createPublicClient, erc20Abi, http, parseUnits } from "viem";
import { base } from "viem/chains";
import { usePublicClient } from "wagmi";
import { ROUTER, USDC } from "@/lib/addresses";

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
        // ETH? Treat as WETH at the router level via path building on your side.
        const token = idOrAddr;

        if (token === "ETH") {
          // Assume 1 ETH -> how many USDC? (use 1e18 in)
          const amountIn = parseUnits("1", 18);
          // path: WETH -> USDC (router should handle WETH address internally)
          // If you want to be explicit, import WETH and use [WETH, USDC]
          const { default: TobySwapperAbi } = await import("@/abi/TobySwapper.json");
          // We only need the router address; if you prefer, use ROUTER constant directly
          const router = ROUTER as Address;

          const amounts = await client.readContract({
            address: router,
            abi: UniV2RouterAbi as any,
            functionName: "getAmountsOut",
            args: [amountIn, [/* WETH */ "0x4200000000000000000000000000000000000006", USDC]],
          });

          const out = (amounts as bigint[])[(amounts as bigint[]).length - 1];
          const usdcDecimals = 6n; // on Base
          const p = Number(out) / Number(10n ** usdcDecimals);
          if (!cancelled) setPrice(p);
          return;
        }

        // ERC20 path: 1 token -> USDC
        // 1) read decimals to normalize
        const [decimals, usdcDecimals] = await Promise.all([
          client.readContract({
            address: token as Address,
            abi: erc20Abi,
            functionName: "decimals",
          }) as Promise<number>,
          client.readContract({
            address: USDC as Address,
            abi: erc20Abi,
            functionName: "decimals",
          }) as Promise<number>,
        ]);

        // 2) quote 1 whole token to USDC
        const amountIn = parseUnits("1", decimals);
        const router = ROUTER as Address;

        const amounts = await client.readContract({
          address: router,
          abi: UniV2RouterAbi as any,
          functionName: "getAmountsOut",
          args: [amountIn, [token as Address, USDC as Address]],
        });

        const out = (amounts as bigint[])[(amounts as bigint[]).length - 1];
        const p = Number(out) / 10 ** usdcDecimals;

        if (!cancelled) setPrice(p);
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
