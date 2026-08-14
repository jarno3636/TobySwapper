import type { Address } from "viem";

export const TABOSHI_SEEDS_ADDRESS =
  "0x02C97bfFEAe8406A3050C83185314B001D84b802" as Address;
export const TABOSHI_SEED_ID = 1n;

export const TABOSHI_SEEDS_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "uri",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
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
    name: "initialized",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "faucet",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "safeTransferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "id", type: "uint256" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export const TABOSHI_SEEDS_BASESCAN =
  `https://basescan.org/token/${TABOSHI_SEEDS_ADDRESS}?a=1` as const;

export function resolveSeedUri(value?: string | null) {
  if (!value) return null;
  const v = value.trim();
  if (v.startsWith("ipfs://ipfs/")) return `https://cloudflare-ipfs.com/ipfs/${v.slice(12)}`;
  if (v.startsWith("ipfs://")) return `https://cloudflare-ipfs.com/ipfs/${v.slice(7)}`;
  if (v.startsWith("ar://")) return `https://arweave.net/${v.slice(5)}`;
  return v;
}

export function seedImageCandidates(value?: string | null) {
  if (!value) return [] as string[];
  const v = value.trim();
  if (!v.startsWith("ipfs://")) return [resolveSeedUri(v)!].filter(Boolean);
  const cidPath = v.replace(/^ipfs:\/\/(?:ipfs\/)?/, "");
  return [
    `https://cloudflare-ipfs.com/ipfs/${cidPath}`,
    `https://ipfs.io/ipfs/${cidPath}`,
    `https://gateway.pinata.cloud/ipfs/${cidPath}`,
  ];
}
