import type { Address } from "viem";

/** Canonical production Lore ERC-721 collection supplied by the project. */
export const LORE_COLLECTION_ADDRESS =
  "0x08f74Dd2913d7A7a4C7339B9106AE14654265b62" as Address;

/** Related unverified Lore system contract supplied by the project. */
export const LORE_SYSTEM_ADDRESS =
  "0x625C1788916E3c0e413B2530CdEee240A62596Fe" as Address;

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
    name: "safeTransferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
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
    name: "totalMinted",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "communityMinted",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "maxSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** Treasury + AMM reserve minted before the community mint opened. */
export const LORE_INITIAL_SUPPLY = 1500n;
