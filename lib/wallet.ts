// lib/wallet.ts
"use client";

import { http, createConfig } from "wagmi";
import { base } from "viem/chains";
import {
  connectorsForWallets,
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
  injectedWallet,
  okxWallet,
  rabbyWallet,
  rainbowWallet,
  trustWallet,
  imTokenWallet,
  zerionWallet,
} from "@rainbow-me/rainbowkit/wallets";

const WC_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID!;
if (!WC_ID) {
  // You can remove this throw in prod, but it's very helpful during setup:
  // Create a WalletConnect Cloud project and set NEXT_PUBLIC_WC_PROJECT_ID.
  console.warn(
    "⚠ NEXT_PUBLIC_WC_PROJECT_ID is missing. WalletConnect-based wallets may not appear."
  );
}

// Optional: your own Base RPC (recommended for Vercel reliability)
const BASE_RPC =
  process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org";

// —— Wallet groups (feel free to reorder) ——
const popular = [
  injectedWallet,    // shows "Injected" in in-app browsers (Trust, MetaMask in-app, etc.)
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
];

const moreWallets = [
  okxWallet,
  rabbyWallet,
  rainbowWallet,
  trustWallet,
  imTokenWallet,
  zerionWallet,
];

// Build connectors
const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: popular,
    },
    {
      groupName: "More",
      wallets: moreWallets,
    },
  ],
  {
    appName: "Toby Swapper",
    projectId: WC_ID || "missing-project-id",
  }
);

// Final wagmi config
export const wagmiConfig = createConfig({
  chains: [base],
  connectors,
  transports: {
    [base.id]: http(BASE_RPC),
  },
  ssr: true, // recommended with Next.js App Router
});
