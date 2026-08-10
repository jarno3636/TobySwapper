// lib/rpc.ts
"use client";

import { createPublicClient, http, fallback } from "viem";
import { base } from "viem/chains";

const endpoints = [
  "/api/rpc",
  process.env.NEXT_PUBLIC_BASE_RPC_URL,
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
  "https://1rpc.io/base",
].filter((x): x is string => Boolean(x));

export function makeBaseClient() {
  return createPublicClient({
    chain: base,
    transport: fallback(
      endpoints.map((url) => http(url, {
        batch: true,
        retryCount: 2,
        retryDelay: 250,
        timeout: 10_000,
      })),
      { rank: true },
    ),
  });
}
