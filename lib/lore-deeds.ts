import type { Address } from "viem";

/**
 * Current Canonical Tobyworld Lore Land Deeds collection.
 * Token IDs intentionally remain the persistent land identity across generations.
 */
export const LORE_COLLECTION_ADDRESS =
  "0x0495601Af6f86efb14C9D478eA46b2Aa09cB164A" as Address;

/** Clear alias used by land-vault and marketplace components. */
export const CANONICAL_LORE_LAND = LORE_COLLECTION_ADDRESS;

/** Previous Lore Land collection. Kept as a historical/tradable asset. */
export const OLD_LORE_COLLECTION_ADDRESS =
  "0x08f74Dd2913d7A7a4C7339B9106AE14654265b62" as Address;

/** Related older Lore system contract. Not treated as the canonical land NFT. */
export const LORE_SYSTEM_ADDRESS =
  "0x625C1788916E3c0e413B2530CdEee240A62596Fe" as Address;

/**
 * Safe ERC-721 surface confirmed by the canonical deployment bytecode.
 * Keep this deliberately small until the project's verified ABI/source is available.
 */
export const LORE_DEEDS_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "getApproved",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "accountOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "createAccount",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "account", type: "address" }],
  },
  {
    type: "function",
    name: "transferNonce",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "genesisSealed",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "revealed",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "unrevealedURI",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "revealTimestamp",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "safeTransferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

/** Previous collection only needs the standard ERC-721 surface in this client. */
export const OLD_LORE_DEEDS_ABI = LORE_DEEDS_ABI;

/** Backwards-compatible names used by existing pouch/market components. */
export const LEGACY_LORE_DEED_ADDRESS = OLD_LORE_COLLECTION_ADDRESS;
export const LEGACY_LORE_DEED_ABI = OLD_LORE_DEEDS_ABI;

export function loreUriCandidates(value?: string | null) {
  if (!value) return [] as string[];
  const v = value.trim();
  if (!v) return [] as string[];

  if (v.startsWith("data:")) return [v];
  if (v.startsWith("ar://")) return [`https://arweave.net/${v.slice(5)}`];

  const ipfsPath =
    v.startsWith("ipfs://ipfs/")
      ? v.slice(12)
      : v.startsWith("ipfs://")
        ? v.slice(7)
        : null;

  if (ipfsPath) {
    return [
      `https://dweb.link/ipfs/${ipfsPath}`,
      `https://ipfs.io/ipfs/${ipfsPath}`,
      `https://inbrowser.link/ipfs/${ipfsPath}`,
    ];
  }

  return [v];
}

export function resolveLoreUri(value?: string | null) {
  return loreUriCandidates(value)[0] || null;
}

/** Clear alias for components that use the canonical-only name. */
export const CANONICAL_LORE_ABI = LORE_DEEDS_ABI;
