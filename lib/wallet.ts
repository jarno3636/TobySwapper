// lib/wallet.ts
"use client";

import { http } from "wagmi";
import { base } from "viem/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

const WC_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || ""; // must be set in prod
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org";

/**
 * getDefaultConfig automatically wires:
 *  - Injected (browser/in-app wallets)
 *  - WalletConnect (deep links & QR)
 *  - Coinbase/Base Wallet
 * and selects the right UX per environment.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "Toby Swapper",
  projectId: WC_ID || "missing-project-id",
  chains: [base],
  /**
   * Force our own RPC for stability on Vercel (RainbowKit will use wagmi transports).
   * This also avoids rate limits from default providers.
   */
  transports: {
    [base.id]: http(BASE_RPC),
  },
  ssr: true,
});
