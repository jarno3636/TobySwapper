import type { Address } from "viem";
import type { MarketplaceAssetKind, MarketplacePayment } from "@/lib/land-exchange";

export type MarketplaceRequest = {
  id: string;
  requester: Address;
  assetKind: MarketplaceAssetKind;
  tokenId?: string | null;
  quantity?: string | null;
  payment: MarketplacePayment;
  budgetAtomic: string;
  note?: string | null;
  status: "active" | "cancelled" | "fulfilled";
  createdAt: string;
};

const CACHE_MS = 2 * 60_000;
let cache: { at: number; rows: MarketplaceRequest[] } | null = null;

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

export function requestMessage(input: {
  requester: string;
  assetKind: MarketplaceAssetKind;
  tokenId: string;
  quantity: string;
  payment: MarketplacePayment;
  budgetAtomic: string;
  note: string;
  timestamp: number;
}) {
  return [
    "Tobyworld Market Request",
    `Requester: ${input.requester.toLowerCase()}`,
    `Asset: ${input.assetKind}`,
    `Token ID: ${input.tokenId || "any"}`,
    `Quantity: ${input.quantity || "1"}`,
    `Payment: ${input.payment}`,
    `Budget: ${input.budgetAtomic}`,
    `Note: ${input.note}`,
    `Timestamp: ${input.timestamp}`,
  ].join("\n");
}

export async function readMarketplaceRequests(force = false) {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const supabase = publicSupabase();
  if (!supabase) return [];
  const response = await fetch(
    `${supabase.url}/rest/v1/tobyswap_market_requests?select=id,requester,asset_kind,token_id,quantity,payment,budget_atomic,note,status,created_at&order=created_at.desc&limit=80`,
    { headers: { apikey: supabase.key, Authorization: `Bearer ${supabase.key}` }, cache: "no-store" },
  );
  if (!response.ok) return [];
  const raw = await response.json();
  const rows: MarketplaceRequest[] = raw.map((row: any) => ({
    id: String(row.id), requester: row.requester, assetKind: row.asset_kind,
    tokenId: row.token_id, quantity: row.quantity, payment: row.payment,
    budgetAtomic: row.budget_atomic, note: row.note, status: row.status, createdAt: row.created_at,
  }));
  cache = { at: Date.now(), rows };
  return rows;
}

export function clearMarketplaceRequestCache() { cache = null; }
