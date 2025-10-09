// lib/wallet.ts
"use client";

import { http } from "wagmi";
import { base } from "viem/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

// REQUIRED: set this in Vercel env for Preview/Prod (and .env.local for dev)
// https://cloud.walletconnect.com
const WC_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org";

/**
 * RainbowKit v2: getDefaultConfig builds a Wagmi config with a
 * battle-tested wallet list (Injected, Coinbase, MetaMask via WC, etc.).
 * If WC_ID is empty or your domain isn’t in WalletConnect “Allowed Origins”,
 * the modal will hide most options → so make sure WC_ID is set & allowed.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "Toby Swapper",
  projectId: WC_ID,                 // ← must be non-empty, and your site domain must be allowed in WC Cloud
  chains: [base],
  transports: {
    [base.id]: http(BASE_RPC),
  },
  ssr: true,
});
