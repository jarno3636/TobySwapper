import type { Address } from "viem";

export const OPEN_FAUCET_ADDRESS =
  "0xd3c76eBb607B72806d6F48FF3CeBd823b5aF9a5e" as Address;

/**
 * Read-only surface needed by the Seeds & Leaves live stats panel.
 * The full Faucet ABI is intentionally not shipped into the client bundle.
 */
export const OPEN_FAUCET_ABI = [
  {
    type: "function",
    name: "totalDraws",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "retainedCbBTC",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "treasury",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "cbBTC",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "currentPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "opened",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "LEAVES_PER_ENHANCED_DRAW",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "STANDARD_SEEDS_PER_DRAW",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "ENHANCED_SEEDS_PER_DRAW",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * The Seed contract can only mint through the bound Faucet. That lets us recover
 * the number of enhanced draws without scanning FaucetDrawn logs:
 *
 * seedSupply = standardDraws * standardSeeds + enhancedDraws * enhancedSeeds
 * totalDraws = standardDraws + enhancedDraws
 */
export function deriveFaucetHistory(args: {
  totalDraws?: bigint;
  totalSeeds?: bigint;
  standardSeedsPerDraw?: bigint;
  enhancedSeedsPerDraw?: bigint;
  leavesPerEnhancedDraw?: bigint;
}) {
  const {
    totalDraws,
    totalSeeds,
    standardSeedsPerDraw,
    enhancedSeedsPerDraw,
    leavesPerEnhancedDraw,
  } = args;

  if (
    totalDraws === undefined ||
    totalSeeds === undefined ||
    standardSeedsPerDraw === undefined ||
    enhancedSeedsPerDraw === undefined ||
    leavesPerEnhancedDraw === undefined
  ) {
    return { enhancedDraws: undefined, standardDraws: undefined, leavesRetired: undefined };
  }

  const delta = enhancedSeedsPerDraw - standardSeedsPerDraw;
  const baseline = totalDraws * standardSeedsPerDraw;
  if (delta <= 0n || totalSeeds < baseline) {
    return { enhancedDraws: undefined, standardDraws: undefined, leavesRetired: undefined };
  }

  const extraSeeds = totalSeeds - baseline;
  if (extraSeeds % delta !== 0n) {
    return { enhancedDraws: undefined, standardDraws: undefined, leavesRetired: undefined };
  }

  const enhancedDraws = extraSeeds / delta;
  if (enhancedDraws > totalDraws) {
    return { enhancedDraws: undefined, standardDraws: undefined, leavesRetired: undefined };
  }

  const standardDraws = totalDraws - enhancedDraws;
  return {
    enhancedDraws,
    standardDraws,
    leavesRetired: enhancedDraws * leavesPerEnhancedDraw,
  };
}

export const OPEN_FAUCET_BASESCAN = `https://basescan.org/address/${OPEN_FAUCET_ADDRESS}`;
