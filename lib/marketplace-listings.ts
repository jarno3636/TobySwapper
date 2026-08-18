"use client";

import type { Address } from "viem";
import {
  LAND_EXCHANGE_ENABLED,
  type MarketplaceAssetKind,
  type MarketplacePayment,
  type TobyworldListing,
} from "@/lib/land-exchange";

const MEMORY_MS = 10 * 60_000;
let hot: { at: number; rows: TobyworldListing[] } | null = null;
let inflight: Promise<TobyworldListing[]> | null = null;

function normalizeRow(row: any): TobyworldListing | null {
  const kind = row?.asset_kind as MarketplaceAssetKind;
  const payment = row?.payment_symbol as MarketplacePayment;
  if (!["seed", "old-land", "lore-land"].includes(kind)) return null;
  if (!["USDC", "ETH", "TOBY"].includes(payment)) return null;
  if (typeof row?.seller !== "string" || typeof row?.asset_address !== "string") return null;
  return {
    listingId: String(row.listing_id ?? row.id ?? ""),
    assetKind: kind,
    assetAddress: row.asset_address as Address,
    seller: row.seller as Address,
    tokenId: row.token_id == null ? undefined : String(row.token_id),
    quantity: row.quantity == null ? undefined : String(row.quantity),
    priceAtomic: String(row.price_atomic ?? "0"),
    payment,
    paymentToken: row.payment_token ? row.payment_token as Address : null,
    status: row.status || "active",
    createdAt: row.created_at || new Date(0).toISOString(),
  };
}

export async function readMarketplaceListings(): Promise<TobyworldListing[]> {
  if (!LAND_EXCHANGE_ENABLED) return [];
  if (hot && Date.now() - hot.at < MEMORY_MS) return hot.rows;
  if (inflight) return inflight;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  inflight = fetch(
    `${url}/rest/v1/tobyswap_market_listings?status=eq.active&select=id,listing_id,asset_kind,asset_address,seller,token_id,quantity,price_atomic,payment_symbol,payment_token,status,created_at&order=created_at.desc&limit=200`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "force-cache" },
  )
    .then(async (response) => {
      if (!response.ok) return [];
      const body = await response.json();
      const rows = Array.isArray(body) ? body.map(normalizeRow).filter(Boolean) as TobyworldListing[] : [];
      hot = { at: Date.now(), rows };
      return rows;
    })
    .catch(() => [])
    .finally(() => { inflight = null; });

  return inflight;
}
