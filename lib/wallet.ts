"use client";

import { http, cookieStorage, createStorage, createConfig } from "wagmi";
import { base } from "viem/chains";

// ✅ Correct connector import package
import { injected } from "@wagmi/connectors/injected";
import { walletConnect } from "@wagmi/connectors/walletConnect";
import { coinbaseWallet } from "@wagmi/connectors/coinbaseWallet";

import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  process.env.NEXT_PUBLIC_WALLETCONNECT_ID ||
  "";

if (!projectId) {
  console.warn("⚠️ WalletConnect disabled: missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");
}

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";

export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || undefined),
  },
  connectors: [
    // Prefer Farcaster connector when inside a Mini App
    miniAppConnector(),

    // Standard web connectors
    injected(),

    walletConnect({
      projectId,
      metadata: {
        name: "TobySwapper",
        description: "Swap on Base with auto-TOBY burn",
        url: siteUrl,
        icons: [`${siteUrl}/favicon.ico`],
      },
      showQrModal: true,
    }),

    coinbaseWallet({
      appName: "TobySwapper",
    }),
  ],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }), // SSR-safe
});
