import type { Address } from "viem";
import { TOBY, USDC } from "@/lib/addresses";
import { TABOSHI_SEEDS_ADDRESS, TABOSHI_SEED_ID } from "@/lib/taboshi-seeds";
import { LEGACY_LORE_DEED_ADDRESS, LORE_COLLECTION_ADDRESS } from "@/lib/lore-deeds";

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
  { id: "seed", label: "Taboshi SEED", shortLabel: "SEED", note: "List whole SEED quantities", standard: "ERC-1155", address: TABOSHI_SEEDS_ADDRESS, tokenId: TABOSHI_SEED_ID, image: "/seed.png", quantityBased: true },
  { id: "old-land", label: "Old Lore Land", shortLabel: "OLD LAND", note: "The earlier Lore land relic", standard: "ERC-721", address: LEGACY_LORE_DEED_ADDRESS, quantityBased: false },
  { id: "lore-land", label: "Lore Land", shortLabel: "LORE LAND", note: "The new land collection", standard: "ERC-721", address: LORE_COLLECTION_ADDRESS, quantityBased: false },
] as const;

export const MARKETPLACE_PAYMENTS = [
  { id: "USDC" as const, label: "USDC", address: USDC, decimals: 6 },
  { id: "ETH" as const, label: "ETH", address: null, decimals: 18 },
  { id: "TOBY" as const, label: "TOBY", address: TOBY, decimals: 18 },
] as const;

/** One percent marketplace fee. Settlement remains disabled until the market contract is deployed. */
export const MARKETPLACE_FEE_BPS = 100 as const;
export const MARKETPLACE_FEE_PERCENT = MARKETPLACE_FEE_BPS / 100;

/**
 * Configure the eventual fee recipient at deployment time. Do not assume another
 * app/signing wallet is also the marketplace treasury.
 */
export const MARKETPLACE_FEE_RECIPIENT = process.env.NEXT_PUBLIC_MARKETPLACE_FEE_RECIPIENT || "";

export type TobyworldListing = {
  listingId: string;
  assetKind: MarketplaceAssetKind;
  seller: Address;
  tokenId?: string;
  quantity?: string;
  priceAtomic: string;
  payment: MarketplacePayment;
  createdAt: string;
};

export type TobyworldExchangeAdapter = {
  readListings(): Promise<TobyworldListing[]>;
};

/** UI groundwork only. Flip this only when an audited settlement contract is actually wired. */
export const LAND_EXCHANGE_ENABLED = false as const;
