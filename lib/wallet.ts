// lib/wallet.ts
"use client";

import { http, createStorage, cookieStorage } from "wagmi";
import { base } from "viem/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

// WalletConnect Cloud project id (required for WC option to render)
const projectId =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "";

// Optional dedicated Base RPC (recommended)
const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org";

/**
 * RainbowKit v2 “default” config builds the right wagmi connectors for:
 * - Injected (MetaMask, Rabby, Trust, OKX, in-app browsers)
 * - Coinbase Wallet (SDK)
 * - WalletConnect (QR / deep-link)
 *
 * It also plays nicely with SSR when you pass cookieStorage.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "Toby Swapper",
  projectId,                 // if empty, WalletConnect will be hidden (expected)
  chains: [base],
  transports: {
    [base.id]: http(rpcUrl),
  },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});
