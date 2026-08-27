import type { Address } from "viem";

export const KEEPER_OF_TOBY = "0x6e7aaa3af558e2C8E2CE1f31FC6b645fAFC27AfA" as Address;
export const KEEPER_MAX_SUPPLY = 111;

export const keeperOfTobyAbi = [
  {
    type: "function",
    name: "MAX_SUPPLY",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
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
    name: "remainingSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "metadataFrozen",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "baseURI",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "contractURI",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "artist",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "commissionedBy",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
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
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "KeeperNamed",
    anonymous: false,
    inputs: [
      { indexed: true, name: "recipient", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
    ],
  },
] as const;

export type KeeperOfTobyPublic = {
  tokenId: number;
  walletDisplay: string;
  xHandle: string | null;
  telegramHandle: string | null;
  imageUrl: string | null;
  namedAt: string | null;
};

export type KeeperOfTobySelf = {
  tokenId: number;
  walletAddress: string;
  xHandle: string | null;
  telegramHandle: string | null;
};

export function shortKeeperAddress(address: string) {
  if (!address || address.length < 12) return "Keeper";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function keeperEdition(tokenId: number | bigint) {
  return `#${String(tokenId).padStart(3, "0")}`;
}

export function resolveKeeperUri(value?: string | null) {
  const uri = String(value || "").trim();
  if (!uri) return null;
  if (uri.startsWith("ipfs://ipfs/")) {
    return `https://ipfs.io/ipfs/${uri.slice(12)}`;
  }
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  if (/^https?:\/\//i.test(uri)) return uri;
  return null;
}
