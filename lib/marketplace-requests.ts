"use client";

import type { Address } from "viem";
import type { MarketplaceAssetKind, MarketplacePayment } from "@/lib/land-exchange";

export type MarketplaceRequest = {
  id: string;
  requester: Address;
  assetKind: MarketplaceAssetKind;
  tokenId?: string;
  quantity?: string;
  payment: MarketplacePayment;
  budgetAtomic: string;
  note?: string | null;
  status: "active" | "filled" | "cancelled" | "expired";
  createdAt: string;
  expiresAt?: string | null;
};

const MEMORY_MS = 10 * 60_000;
let hot: { at: number; rows: MarketplaceRequest[] } | null = null;
let inflight: Promise<MarketplaceRequest[]> | null = null;

function normalizeRow(row: any): MarketplaceRequest | null {
  const assetKind = row?.asset_kind as MarketplaceAssetKind;
  const payment = row?.payment_symbol as MarketplacePayment;
  if (!["seed", "old-land", "lore-land"].includes(assetKind)) return null;
  if (!["USDC", "ETH", "TOBY"].includes(payment)) return null;
  if (typeof row?.requester !== "string") return null;

  return {
    id: String(row.id ?? ""),
    requester: row.requester as Address,
    assetKind,
    tokenId: row.token_id == null ? undefined : String(row.token_id),
    quantity: row.quantity == null ? undefined : String(row.quantity),
    payment,
    budgetAtomic: String(row.budget_atomic ?? "0"),
    note: typeof row.note === "string" ? row.note : null,
    status: row.status || "active",
    createdAt: row.created_at || new Date(0).toISOString(),
    expiresAt: row.expires_at || null,
  };
}

export function marketplaceRequestMessage(input: {
  requester: string;
  assetKind: MarketplaceAssetKind;
  tokenId: string;
  quantity: string;
  payment: MarketplacePayment;
  budgetAtomic: string;
  note: string;
  expiresAt: string;
  nonce: string;
  timestamp: number;
}) {
  return [
    "Tobyworld Market Request",
    `Requester: ${input.requester.toLowerCase()}`,
    `Asset: ${input.assetKind}`,
    `Token ID: ${input.tokenId}`,
    `Quantity: ${input.quantity}`,
    `Payment: ${input.payment}`,
    `Budget: ${input.budgetAtomic}`,
    `Note: ${input.note.trim()}`,
    `Expires: ${input.expiresAt}`,
    `Nonce: ${input.nonce}`,
    `Timestamp: ${input.timestamp}`,
  ].join("\n");
}

export function marketplaceRequestCancelMessage(input: {
  requester: string;
  requestId: string;
  timestamp: number;
}) {
  return [
    "Cancel Tobyworld Market Request",
    `Requester: ${input.requester.toLowerCase()}`,
    `Request: ${input.requestId}`,
    `Timestamp: ${input.timestamp}`,
  ].join("\n");
}

export async function readMarketplaceRequests(force = false): Promise<MarketplaceRequest[]> {
  if (!force && hot && Date.now() - hot.at < MEMORY_MS) return hot.rows;
  if (!force && inflight) return inflight;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  const work = fetch(
    `${url}/rest/v1/tobyswap_market_requests?status=eq.active&select=id,requester,asset_kind,token_id,quantity,payment_symbol,budget_atomic,note,status,created_at,expires_at&order=created_at.desc&limit=120`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
  )
    .then(async (response) => {
      if (!response.ok) return [];
      const body = await response.json();
      const now = Date.now();
      const rows = Array.isArray(body)
        ? (body.map(normalizeRow).filter(Boolean) as MarketplaceRequest[]).filter((row) => !row.expiresAt || Date.parse(row.expiresAt) > now)
        : [];
      hot = { at: Date.now(), rows };
      return rows;
    })
    .catch(() => [])
    .finally(() => {
      if (inflight === work) inflight = null;
    });

  if (!force) inflight = work;
  return work;
}

export function clearMarketplaceRequestCache() {
  hot = null;
  inflight = null;
}
