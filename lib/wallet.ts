"use client";

import { http, cookieStorage, createStorage, createConfig } from "wagmi";
import { base } from "viem/chains";

// Use Wagmi’s first-party connectors directly
import { injected } from "wagmi/connectors/injected";
import { walletConnect } from "wagmi/connectors/walletConnect";
import { coinbaseWallet } from "wagmi/connectors/coinbaseWallet";

// Farcaster Mini-App connector (preferred in-app)
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

    // Standard web connectors (RainbowKit will use these just fine)
    injected(),

    walletConnect({
      projectId,
      metadata: {
        name: "TobySwapper",
        description: "Swap on Base with auto-TOBY burn",
        url: siteUrl,
        icons: [`${siteUrl}/favicon.ico`],
      },
      // optional: enable/disable QR modal if you like
      showQrModal: true,
    }),

    coinbaseWallet({
      appName: "TobySwapper",
    }),
  ],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }), // SSR-safe
});
