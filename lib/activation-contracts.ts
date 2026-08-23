import type { Address } from "viem";

export const BASE_CHAIN_ID = 8453 as const;

export const CANONICAL_LORE_NFT =
  "0x0495601Af6f86efb14C9D478eA46b2Aa09cB164A" as Address;
export const ACTIVATION_MANAGER =
  "0xDAf88BF803765882a674Bc9B2bCE20D47A7250F2" as Address;
export const ACTIVATION_VAULT =
  "0xD49c3F0dd67378Be76a1142Dfb9a5107F99a34DD" as Address;
export const ACTIVATION_TOBY =
  "0xb8D98a102b0079B69FFbc760C8d857A31653e56e" as Address;
export const ACTIVATION_PATIENCE =
  "0x6D96f18F00B815B2109A3766E79F6A7aD7785624" as Address;

export const MINIMUM_LOCK_SECONDS = 90 * 24 * 60 * 60;
export const ACTIVATION_DEADLINE_SECONDS = 10 * 60;

export const activationBaseScanTx = (hash: `0x${string}`) =>
  `https://basescan.org/tx/${hash}` as const;
