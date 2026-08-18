export type LandListing = {
  tokenId: string;
  seller: `0x${string}`;
  priceAtomic: string;
  quoteToken: `0x${string}`;
  createdAt: string;
};

/**
 * Exchange groundwork only. Keep the UI independent from the future market contract.
 * When the canonical listing / settlement contract is known, one adapter can populate
 * this shape without rewriting World or individual land pages.
 */
export type LandExchangeAdapter = {
  readListings(): Promise<LandListing[]>;
};

export const LAND_EXCHANGE_ENABLED = false as const;
