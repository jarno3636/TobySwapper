// lib/wallet.ts
"use client";

import { http } from "wagmi";
import { base } from "viem/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

const WC_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
if (!WC_ID) {
  console.warn(
    "⚠ NEXT_PUBLIC_WC_PROJECT_ID is missing. WalletConnect-based wallets may be limited/hidden."
  );
}

// Optional: custom Base RPC (recommended on Vercel)
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org";

/**
 * getDefaultConfig sets up:
 *  - Injected (works in in-app wallet browsers)
 *  - MetaMask, Coinbase, Rainbow, Rabby, Trust, Zerion, OKX via WalletConnect
 *  - WalletConnect (uses your projectId)
 */
export const wagmiConfig = getDefaultConfig({
  appName: "Toby Swapper",
  projectId: WC_ID || "missing-project-id",
  chains: [base],
  transports: {
    [base.id]: http(BASE_RPC),
  },
  ssr: true, // Next.js App Router friendly
});
