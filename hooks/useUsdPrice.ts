// hooks/useUsdPrice.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { Address, erc20Abi, formatUnits, parseUnits } from "viem";
import { usePublicClient } from "wagmi";
import { USDC, WETH } from "@/lib/addresses";

/** Minimal router ABI: only what's needed */
const uniV2RouterAbi = [
  {
    name: "getAmountsOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

/**
 * Get USD price for:
 * - "ETH" -> CoinGecko
 * - any ERC20 -> on-chain via Router getAmountsOut (token -> WETH -> USDC)
 *
 * Provide `router` address (UniswapV2-compatible) and USDC decimals.
 * Polls every `refreshMs` (default 30s).
 */
export function useUsdPrice({
  token,
  router,
  refreshMs = 30_000,
}: {
  token: Address | "ETH";
  router: Address;
  refreshMs?: number;
}) {
  const client = usePublicClient();
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const isEth = token === "ETH";

  useEffect(() => {
    let mounted = true;
    let timer: any;

    const fetchPrice = async () => {
      try {
        setLoading(true);

        if (isEth) {
          // ---- ETH/USD via CoinGecko ----
          const res = await fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
            { cache: "no-store" }
          );
          const json = await res.json();
          if (!mounted) return;
          setPrice(Number(json?.ethereum?.usd ?? 0));
          setLoading(false);
          return;
        }

        // ---- ERC20 -> price via Router getAmountsOut ----
        // 1) read ERC20 decimals
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

        // 2) getAmountsOut for 1 token: token -> WETH -> USDC (or token->USDC if WETH path is unnecessary)
        const path: Address[] =
          (token as Address).toLowerCase() === WETH.toLowerCase()
            ? [token as Address, USDC as Address]
            : [token as Address, WETH as Address, USDC as Address];

        const oneToken = parseUnits("1", decimals);
        const amounts = (await client.readContract({
          address: router,
          abi: uniV2RouterAbi,
          functionName: "getAmountsOut",
          args: [oneToken, path],
        })) as bigint[];

        const out = amounts[amounts.length - 1];
        const usd = Number(formatUnits(out, usdcDecimals)); // 1 token in USD (because last hop is USDC)

        if (!mounted) return;
        setPrice(usd);
        setLoading(false);
      } catch (e) {
        if (!mounted) return;
        setPrice(null);
        setLoading(false);
      } finally {
        if (!mounted) return;
        timer = setTimeout(fetchPrice, refreshMs);
      }
    };

    fetchPrice();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [client, isEth, token, router, refreshMs]);

  return useMemo(
    () => ({ price, loading }),
    [price, loading]
  );
}
