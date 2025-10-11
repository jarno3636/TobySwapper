import type { Address } from "viem";
import { isAddressEqual, getAddress } from "viem";

// Base mainnet (chainId 8453)
export const CHAIN_ID = 8453 as const;
export const BASESCAN = "https://basescan.org" as const;

/** Special sentinel for native ETH (no ERC-20 address) */
export const NATIVE_ETH = "NATIVE_ETH" as const;
export type TokenAddress = Address | typeof NATIVE_ETH;

/* ------------------------------- Core tokens ------------------------------- */
export const WETH: Address = "0x4200000000000000000000000000000000000006";
export const USDC: Address = "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913";

/* ----------------------------- Tobyworld tokens ---------------------------- */
export const TOBY: Address     = "0xb8D98a102b0079B69FFbc760C8d857A31653e56e";
export const PATIENCE: Address = "0x6D96f18F00B815B2109A3766E79F6A7aD7785624";
export const TABOSHI: Address  = "0x3a1a33cf4553db61f0db2c1e1721cd480b02789f";

/* -------------------------- Routers / burn / misc -------------------------- */
// Uniswap V2 (Base)
export const QUOTE_ROUTER_V2: Address   = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24";
export const UNISWAP_V2_FACTORY: Address = "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6";

// Uniswap V3 (Base)
export const UNISWAP_V3_FACTORY: Address = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
export const QUOTER_V3: Address          = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
export const SWAP_ROUTER_V3: Address     = "0x2626664c2603336E57B271c5C0b26F421741e481";
export const UNIVERSAL_ROUTER: Address   = "0x6fF5693b99212Da76Ad316178A184AB56D299B43";

// Your contracts
export const SWAPPER: Address = "0xfC098D8d13CD4583715ECc2eFC1894F39947599d";
export const DEAD: Address    = "0x000000000000000000000000000000000000dEaD";

/* ------------------------------ Token registry ----------------------------- */
export type TokenInfo = { symbol: string; address: TokenAddress; decimals: number };

export const TOKENS: readonly TokenInfo[] = [
  { symbol: "ETH",      address: NATIVE_ETH, decimals: 18 }, // native Base ETH (gas)
  { symbol: "WETH",     address: WETH,       decimals: 18 }, // wrapped ETH (ERC-20)
  { symbol: "USDC",     address: USDC,       decimals: 6  },
  { symbol: "TOBY",     address: TOBY,       decimals: 18 },
  { symbol: "PATIENCE", address: PATIENCE,   decimals: 18 },
  { symbol: "TABOSHI",  address: TABOSHI,    decimals: 18 },
] as const;

export const TOKENS_MAP = Object.freeze(
  TOKENS.reduce<Record<string, TokenInfo>>((acc, t) => { acc[t.symbol] = t; return acc; }, {})
);

/* --------------------------------- Routing --------------------------------- */
export const V3_FEE_TIERS = [500, 3000, 10000] as const;
export const ROUTING_HUBS: Address[] = [WETH, USDC];

/* --------------------------------- Helpers --------------------------------- */
export const isUSDC = (addr?: Address | string): boolean =>
  !!addr && isAddressEqual(addr as Address, USDC);

export const isWETH = (addr?: Address | string): boolean =>
  !!addr && isAddressEqual(addr as Address, WETH);

export const isNative = (addr?: TokenAddress): addr is typeof NATIVE_ETH =>
  addr === NATIVE_ETH;

export const eqAddr = (a?: Address | string, b?: Address | string): boolean =>
  !!a && !!b && isAddressEqual(getAddress(a as Address), getAddress(b as Address));

export const addrToSymbol = (addr?: TokenAddress): string | undefined => {
  if (isNative(addr)) return "ETH";
  return addr ? TOKENS.find(t => t.address !== NATIVE_ETH && eqAddr(t.address as Address, addr))?.symbol : undefined;
};

export const symbolToToken = (sym?: string): TokenInfo | undefined =>
  sym ? TOKENS_MAP[sym] : undefined;

/* --------------------------------- Basescan -------------------------------- */
export const basescanAddress = (addr: Address) => `${BASESCAN}/address/${addr}` as const;
export const basescanTx = (tx: `0x${string}`) => `${BASESCAN}/tx/${tx}` as const;
