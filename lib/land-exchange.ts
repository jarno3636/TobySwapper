import type { Address } from "viem";
import { TOBY, USDC } from "@/lib/addresses";
import { TABOSHI_SEEDS_ADDRESS, TABOSHI_SEED_ID } from "@/lib/taboshi-seeds";
import { OLD_LORE_COLLECTION_ADDRESS, LORE_COLLECTION_ADDRESS } from "@/lib/lore-deeds";

export type MarketplaceAssetKind = "seed" | "old-land" | "lore-land";
export type MarketplacePayment = "USDC" | "ETH" | "TOBY";
export type MarketplaceStandard = "ERC-1155" | "ERC-721";

export type MarketplaceAsset = {
  id: MarketplaceAssetKind;
  label: string;
  shortLabel: string;
  note: string;
  standard: MarketplaceStandard;
  address: Address;
  tokenId?: bigint;
  image?: string;
  quantityBased: boolean;
};

export const MARKETPLACE_ASSETS: readonly MarketplaceAsset[] = [
  {
    id: "seed",
    label: "Taboshi SEED",
    shortLabel: "SEED",
    note: "Sell whole SEED quantities",
    standard: "ERC-1155",
    address: TABOSHI_SEEDS_ADDRESS,
    tokenId: TABOSHI_SEED_ID,
    image: "/seed.png",
    quantityBased: true,
  },
  {
    id: "old-land",
    label: "Old Lore Land",
    shortLabel: "OLD LAND",
    note: "Previous Lore Land collection",
    standard: "ERC-721",
    address: OLD_LORE_COLLECTION_ADDRESS,
    quantityBased: false,
  },
  {
    id: "lore-land",
    label: "Canonical Lore Land",
    shortLabel: "LORE LAND",
    note: "Current canonical Tobyworld land deed",
    standard: "ERC-721",
    address: LORE_COLLECTION_ADDRESS,
    quantityBased: false,
  },
] as const;

export const MARKETPLACE_PAYMENTS = [
  { id: "USDC" as const, label: "USDC", address: USDC, decimals: 6 },
  { id: "ETH" as const, label: "ETH", address: null, decimals: 18 },
  { id: "TOBY" as const, label: "TOBY", address: TOBY, decimals: 18 },
] as const;

/** One percent marketplace fee. Settlement remains disabled until the market contract is deployed. */
export const MARKETPLACE_FEE_BPS = 100 as const;
export const MARKETPLACE_FEE_PERCENT = MARKETPLACE_FEE_BPS / 100;

/** Set once the audited marketplace contract is deployed. */
export const MARKETPLACE_CONTRACT = process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT || "";
export const MARKETPLACE_FEE_RECIPIENT = process.env.NEXT_PUBLIC_MARKETPLACE_FEE_RECIPIENT || "";

export type TobyworldListing = {
  listingId: string;
  assetKind: MarketplaceAssetKind;
  assetAddress: Address;
  seller: Address;
  tokenId?: string;
  quantity?: string;
  priceAtomic: string;
  payment: MarketplacePayment;
  paymentToken?: Address | null;
  status: "active" | "sold" | "cancelled" | "expired";
  createdAt: string;
};

/** UI + database groundwork only. Turn this on with the audited settlement contract. */
export const LAND_EXCHANGE_ENABLED = false as const;
