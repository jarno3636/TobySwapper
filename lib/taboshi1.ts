import type { Address } from "viem";

export const TABOSHI1_ADDRESS =
  "0x5C0BF08936bcCfbb6af24B4648A9fb365cAa2F4e" as Address;
export const TABOSHI1_TOKEN_ID = 1n;

export const TABOSHI1_ABI = [
  {
    type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }, { name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "uri", stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function", name: "totalSupply", stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "safeTransferFrom", stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" }, { name: "to", type: "address" },
      { name: "id", type: "uint256" }, { name: "amount", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export const TABOSHI1_BASESCAN =
  `https://basescan.org/nft/${TABOSHI1_ADDRESS.toLowerCase()}/1`;
export const TABOSHI1_OPENSEA =
  `https://opensea.io/item/base/${TABOSHI1_ADDRESS.toLowerCase()}/1`;

export function resolveIpfs(value?: string | null) {
  if (!value) return null;
  if (value.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${value.slice(7)}`;
  return value;
}
