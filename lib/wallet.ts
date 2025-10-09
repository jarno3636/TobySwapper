// lib/wallet.ts
"use client";

import { createConfig, http } from "wagmi";
import { base } from "viem/chains";
import { injected } from "wagmi/connectors";
import { walletConnect } from "wagmi/connectors";
import { coinbaseWallet } from "wagmi/connectors";

const WC_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
if (!WC_ID) {
  console.warn("⚠ NEXT_PUBLIC_WC_PROJECT_ID is missing. WalletConnect wallets may not work.");
}

const APP_URL  = process.env.NEXT_PUBLIC_APP_URL || "https://tobyswap.vercel.app";
const APP_ICON = `${APP_URL}/toby2.PNG`;
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org";

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    // Works in MetaMask/Trust/Rabby/Rainbow in-app browsers *and* desktop if an injected provider exists.
    injected({
      shimDisconnect: true,               // remember last session
      // Some wallets only expose provider after a user gesture; wagmi handles lazy detection internally.
    }),

    // Coinbase (App & Extension). Preference "all" lets users pick App/Extension.
    coinbaseWallet({
      appName: "Toby Swapper",
      preference: "all",
      // If you only want the app, use preference: "smart" or "wallet".
    }),

    // WalletConnect v2 — deep linking on mobile
    walletConnect({
      projectId: WC_ID || "missing-project-id",
      showQrModal: true,
      metadata: {
        name: "Toby Swapper",
        description: "Swap on Base with auto-TOBY burn.",
        url: APP_URL,            // MUST match the site you open inside the wallet
        icons: [APP_ICON],       // 256–512px icon
      },
    }),
  ],
  transports: {
    [base.id]: http(BASE_RPC),
  },
  ssr: true,
});
