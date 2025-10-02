// lib/wallet.ts
"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, fallback } from "viem";
import { base } from "viem/chains";

/**
 * RainbowKit/Wagmi config for TobySwapper (Base mainnet)
 *
 * Env you should set in Vercel:
 * - NEXT_PUBLIC_PROJECT_NAME=TobySwapper
 * - NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=3e438566e70a1cb70e52acebf3625cf8
 * - NEXT_PUBLIC_RPC_BASE=https://base-mainnet.g.alchemy.com/v2/CMZxEWtahlNfTGTNOdO0f
 */

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo";

if (typeof window !== "undefined" && projectId === "demo") {
  // eslint-disable-next-line no-console
  console.warn(
    "[Wallet] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is missing. WalletConnect modal may not work."
  );
}

const alchemyRpc = process.env.NEXT_PUBLIC_RPC_BASE;
const publicRpc = "https://mainnet.base.org";

// viem’s fallback() will round-robin / failover between transports
const transport = alchemyRpc
  ? fallback([http(alchemyRpc), http(publicRpc)])
  : http(publicRpc);

export const wagmiConfig = getDefaultConfig({
  appName: process.env.NEXT_PUBLIC_PROJECT_NAME || "TobySwapper",
  projectId,
  ssr: true, // smoother hydration with Next.js 14
  chains: [base],
  transports: {
    [base.id]: transport,
  },
});
