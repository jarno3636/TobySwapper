// lib/addresses.ts
// Base mainnet (chainId 8453)
export const CHAIN_ID = 8453 as const;

// Core tokens
export const WETH  = "0x4200000000000000000000000000000000000006" as const;
export const USDC  = "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913" as const;

// Tobyworld tokens
export const TOBY     = "0xb8D98a102b0079B69FFbc760C8d857A31653e56e" as const;
export const PATIENCE = "0x6D96f18F00B815B2109A3766E79F6A7aD7785624" as const;
export const TABOSHI  = "0x3a1a33cf4553db61f0db2c1e1721cd480b02789f" as const;

// Router / burn / swapper
export const ROUTER  = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24" as const;
export const DEAD    = "0x000000000000000000000000000000000000dEaD" as const;
export const SWAPPER = "0x6da391f470a00a206dded0f5fc0f144cae776d7c" as const;

// Token list for selects
export type TokenInfo = { symbol: string; address: `0x${string}`; decimals: number };

export const TOKENS: readonly TokenInfo[] = [
  { symbol: "USDC",     address: USDC,     decimals: 6  },
  { symbol: "WETH",     address: WETH,     decimals: 18 },
  { symbol: "TOBY",     address: TOBY,     decimals: 18 },
  { symbol: "PATIENCE", address: PATIENCE, decimals: 18 },
  { symbol: "TABOSHI",  address: TABOSHI,  decimals: 18 },
] as const;

/** Small helper that’s handy all over the app */
export const isUSDC = (addr?: string) =>
  !!addr && addr.toLowerCase() === USDC.toLowerCase();
