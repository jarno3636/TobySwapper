import type { Address } from "viem";
import { isAddressEqual } from "viem";

// Base mainnet (chainId 8453)
export const CHAIN_ID = 8453 as const;
export const BASESCAN = "https://basescan.org" as const;

// Core tokens
export const WETH: Address = "0x4200000000000000000000000000000000000006";
export const USDC: Address = "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913";

// Tobyworld tokens
export const TOBY: Address     = "0xb8D98a102b0079B69FFbc760C8d857A31653e56e";
export const PATIENCE: Address = "0x6D96f18F00B815B2109A3766E79F6A7aD7785624";
export const TABOSHI: Address  = "0x3a1a33cf4553db61f0db2c1e1721cd480b02789f";

// Quoting router (V2). MUST match what your TobySwapper contract uses on-chain.
export const QUOTE_ROUTER_V2: Address = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24";

// Your swapper (spender for approvals)
export const SWAPPER: Address = "0x6da391F470a00A206DDED0F5FC0f144cAe776D7c";
export const DEAD: Address    = "0x000000000000000000000000000000000000dEaD";

// Token list for selects
export type TokenInfo = { symbol: string; address: Address; decimals: number };
export const TOKENS: readonly TokenInfo[] = [
  { symbol: "USDC",     address: USDC,     decimals: 6  },
  { symbol: "WETH",     address: WETH,     decimals: 18 },
  { symbol: "TOBY",     address: TOBY,     decimals: 18 },
  { symbol: "PATIENCE", address: PATIENCE, decimals: 18 },
  { symbol: "TABOSHI",  address: TABOSHI,  decimals: 18 },
] as const;

export const TOKENS_MAP = Object.freeze(
  TOKENS.reduce<Record<string, TokenInfo>>((acc, t) => {
    acc[t.symbol] = t;
    return acc;
  }, {})
);

export const isUSDC = (addr?: Address | string): boolean =>
  !!addr && isAddressEqual(addr as Address, USDC);

// helpers
export const basescanAddress = (addr: Address) => `${BASESCAN}/address/${addr}` as const;
export const basescanTx = (tx: `0x${string}`) => `${BASESCAN}/tx/${tx}` as const;
