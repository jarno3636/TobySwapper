"use client";

import type { Address } from "viem";
import { zeroAddress } from "viem";
import { makeBaseClient } from "@/lib/rpc";
import {
  MARKETPLACE_ASSETS,
  MARKETPLACE_PAYMENTS,
  type MarketplaceAssetKind,
  type MarketplacePayment,
  type TobyworldListing,
} from "@/lib/land-exchange";
import { MARKETPLACE_ABI, MARKETPLACE_ADDRESS } from "@/lib/marketplace-contract";

const MEMORY_MS = 45_000;
const MAX_RECENT_LISTINGS = 120;
let hot: { at: number; rows: TobyworldListing[] } | null = null;
let inflight: Promise<TobyworldListing[]> | null = null;

const kindByIndex: MarketplaceAssetKind[] = ["seed", "old-land", "lore-land"];

function paymentFromAddress(value: string): MarketplacePayment | null {
  if (value.toLowerCase() === zeroAddress) return "ETH";
  const found = MARKETPLACE_PAYMENTS.find(
    (payment) => payment.address?.toLowerCase() === value.toLowerCase(),
  );
  return found?.id ?? null;
}

export async function readMarketplaceListings(force = false): Promise<TobyworldListing[]> {
  if (!force && hot && Date.now() - hot.at < MEMORY_MS) return hot.rows;
  if (!force && inflight) return inflight;

  const request = (async () => {
    const client = makeBaseClient();
    const next = await client.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: MARKETPLACE_ABI,
      functionName: "nextListingId",
    });

    const end = Number(next);
    if (end <= 1) return [];

    const start = Math.max(1, end - MAX_RECENT_LISTINGS);
    const ids = Array.from({ length: end - start }, (_, index) => BigInt(start + index));

    const results = await client.multicall({
      allowFailure: true,
      contracts: ids.map((id) => ({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "listings",
        args: [id],
      })) as any,
    });

    const now = Math.floor(Date.now() / 1000);
    const rows: TobyworldListing[] = [];

    results.forEach((result: any, index) => {
      if (result.status !== "success" || !result.result) return;
      const value: any = result.result;
      const seller = value.seller ?? value[0];
      const paymentToken = value.paymentToken ?? value[1];
      const tokenId = BigInt(value.tokenId ?? value[2]);
      const quantity = BigInt(value.quantity ?? value[3]);
      const price = BigInt(value.price ?? value[4]);
      const expiresAt = Number(value.expiresAt ?? value[5]);
      const assetKindIndex = Number(value.assetKind ?? value[6]);
      const rawStatus = Number(value.status ?? value[7]);
      if (!seller || rawStatus === 0) return;

      const kind = kindByIndex[assetKindIndex];
      const payment = paymentFromAddress(String(paymentToken));
      const asset = MARKETPLACE_ASSETS[assetKindIndex];
      if (!kind || !payment || !asset) return;

      let status: TobyworldListing["status"] =
        rawStatus === 1 ? "active" : rawStatus === 2 ? "sold" : "cancelled";
      if (status === "active" && expiresAt > 0 && expiresAt < now) status = "expired";

      rows.push({
        listingId: ids[index].toString(),
        assetKind: kind,
        assetAddress: asset.address as Address,
        seller: seller as Address,
        tokenId: kind === "seed" ? undefined : tokenId.toString(),
        quantity: quantity.toString(),
        priceAtomic: price.toString(),
        payment,
        paymentToken: String(paymentToken).toLowerCase() === zeroAddress ? null : paymentToken as Address,
        status,
        createdAt: ids[index].toString(),
      });
    });

    rows.sort((a, b) => Number(b.listingId) - Number(a.listingId));
    hot = { at: Date.now(), rows };
    return rows;
  })().catch(() => [] as TobyworldListing[]);

  inflight = request;
  try {
    return await request;
  } finally {
    inflight = null;
  }
}

export function clearMarketplaceListingCache() {
  hot = null;
}
