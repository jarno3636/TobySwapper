// lib/wallet.ts
"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { base } from "viem/chains";

/**
 * RainbowKit/Wagmi config for TobySwapper
 * - Uses NEXT_PUBLIC_PROJECT_NAME (fallback "TobySwapper")
 * - Uses NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID (must be set for WalletConnect v2)
 * - RPC comes from NEXT_PUBLIC_RPC_BASE (or Base public RPC as a fallback)
 */
export const wagmiConfig = getDefaultConfig({
  appName: process.env.NEXT_PUBLIC_PROJECT_NAME || "TobySwapper",

  // WalletConnect V2 projectId (get one free at https://cloud.walletconnect.com)
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",

  chains: [base],

  // transports must map chainId -> transport
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_RPC_BASE || "https://mainnet.base.org"),
  },

  // Nice to have for Next.js 14 to keep hydration smooth
  ssr: true,
});
