import type { Address } from "viem";

export const MARKETPLACE_ADDRESS =
  "0x4F1D4C06Bbc9438A2AbB6558dfDd940B65588011" as Address;

export const MARKETPLACE_ABI = [
  { type: "function", name: "nextListingId", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  {
    type: "function", name: "listings", stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "seller", type: "address" }, { name: "paymentToken", type: "address" },
      { name: "tokenId", type: "uint256" }, { name: "quantity", type: "uint256" },
      { name: "price", type: "uint256" }, { name: "expiresAt", type: "uint64" },
      { name: "assetKind", type: "uint8" }, { name: "status", type: "uint8" },
    ],
  },
  {
    type: "function", name: "createListing", stateMutability: "nonpayable",
    inputs: [
      { name: "assetKind", type: "uint8" }, { name: "tokenId", type: "uint256" },
      { name: "quantity", type: "uint256" }, { name: "paymentToken", type: "address" },
      { name: "price", type: "uint256" }, { name: "expiresAt", type: "uint64" },
    ], outputs: [{ name: "listingId", type: "uint256" }],
  },
  {
    type: "function", name: "updateListing", stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "uint256" }, { name: "paymentToken", type: "address" },
      { name: "price", type: "uint256" }, { name: "expiresAt", type: "uint64" },
    ], outputs: [],
  },
  { type: "function", name: "cancelListing", stateMutability: "nonpayable", inputs: [{ name: "listingId", type: "uint256" }], outputs: [] },
  {
    type: "function", name: "buy", stateMutability: "payable",
    inputs: [
      { name: "listingId", type: "uint256" }, { name: "expectedPaymentToken", type: "address" },
      { name: "expectedPrice", type: "uint256" },
    ], outputs: [],
  },
  { type: "function", name: "isListingExecutable", stateMutability: "view", inputs: [{ name: "listingId", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  {
    type: "function", name: "quoteFee", stateMutability: "pure", inputs: [{ name: "price", type: "uint256" }],
    outputs: [{ name: "fee", type: "uint256" }, { name: "sellerProceeds", type: "uint256" }],
  },
] as const;

export const ERC20_MARKET_ABI = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
] as const;

export const ERC721_MARKET_ABI = [
  { type: "function", name: "getApproved", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [] },
] as const;

export const ERC1155_MARKET_ABI = [
  { type: "function", name: "isApprovedForAll", stateMutability: "view", inputs: [{ name: "account", type: "address" }, { name: "operator", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "setApprovalForAll", stateMutability: "nonpayable", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [] },
] as const;
