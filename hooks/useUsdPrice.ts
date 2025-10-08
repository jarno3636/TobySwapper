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

// force same router as app uses
const ROUTER = ADDR.QUOTE_ROUTER_V2;
const WETH = ADDR.WETH;
const USDC = ADDR.USDC;

function useSafePublicClient() {
  const wagmiClient = usePublicClient();
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_BASE ||
    (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
      ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
      : "https://mainnet.base.org");

  return (
    wagmiClient ??
    createPublicClient({
      chain: base,
      transport: http(rpcUrl),
    })
  );
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
