// lib/rpc.ts
"use client";

import { createPublicClient, http, fallback } from "viem";
import { base } from "viem/chains";

// You can override/add through env without code changes.
const endpoints = [
  process.env.NEXT_PUBLIC_RPC_BASE,
  process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
    ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
    : undefined,
  // solid public pool:
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
  "https://1rpc.io/base",
].filter(Boolean) as string[];

export function makeBaseClient() {
  const transports = endpoints.map((url) =>
    http(url, {
      batch: true,
      retryCount: 3,
      retryDelay: 300,
      timeout: 10_000,
    })
  );

  // viem will rotate on errors/timeouts automatically.
  const transport =
    transports.length > 1 ? fallback(transports, { rank: true }) : transports[0];

  return createPublicClient({
    chain: base,
    transport,
  });
}
