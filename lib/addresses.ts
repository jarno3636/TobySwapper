import type { Address } from "viem"

export const ADDR: {
  ROUTER: Address
  WETH: Address
  USDC: Address
  TOBY: Address
  PATIENCE: Address
  TABOSHI: Address
  SWAPPER: Address
  BURN: Address
} = {
  ROUTER: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
  WETH:   "0x4200000000000000000000000000000000000006",
  USDC:   "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913",
  TOBY:   "0xb8D98a102b0079B69FFbc760C8d857A31653e56e",
  PATIENCE:"0x6D96f18F00B815B2109A3766E79F6A7aD7785624",
  TABOSHI: "0x3a1a33cf4553db61f0db2c1e1721cd480b02789f",
  SWAPPER: "0x6da391f470a00a206dded0f5fc0f144cae776d7c",
  BURN:    "0x000000000000000000000000000000000000dEaD",
}

export type TokenInfo = {
  symbol: string
  address: Address
  decimals: number
}

export const TOKENS: Record<"USDC"|"WETH"|"TOBY"|"PATIENCE"|"TABOSHI", TokenInfo> = {
  USDC: { symbol: "USDC", address: ADDR.USDC, decimals: 6 },
  WETH: { symbol: "WETH", address: ADDR.WETH, decimals: 18 },
  TOBY: { symbol: "TOBY", address: ADDR.TOBY, decimals: 18 },
  PATIENCE: { symbol: "PATIENCE", address: ADDR.PATIENCE, decimals: 18 },
  TABOSHI: { symbol: "TABOSHI", address: ADDR.TABOSHI, decimals: 18 },
}

// Use Set<string> for easy .has() on string values from <select>
export const ALLOWED_BASES: Set<string> = new Set<string>([ADDR.USDC, ADDR.WETH])
export const ALLOWED_COMMODITIES: Set<string> = new Set<string>([ADDR.TOBY, ADDR.PATIENCE, ADDR.TABOSHI])
