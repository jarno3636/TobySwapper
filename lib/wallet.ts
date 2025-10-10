// lib/wallet.ts
"use client";

import { createConfig, http } from "wagmi";
import { base } from "viem/chains";
import { injected } from "wagmi/connectors";
import { walletConnect } from "wagmi/connectors";
import { coinbaseWallet } from "wagmi/connectors";

const WC_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org";

const connectors = [
  injected({
    shimDisconnect: true,
    target: "metaMask", // prefers MM if multiple injecteds; falls back automatically
  }),
  coinbaseWallet({
    appName: "Toby Swapper",
    preference: "all", // QR + deep-link
  }),
  ...(WC_ID
    ? [
        walletConnect({
          projectId: WC_ID,
          showQrModal: true,
          metadata: {
            name: "Toby Swapper",
            description: "Swap on Base with 1% auto-burn to $TOBY",
            url: "https://tobyswap.vercel.app",
            icons: ["https://tobyswap.vercel.app/og.png"],
          },
          // Recommended on mobile to keep the WC modal in-app
          qrModalOptions: {
            themeMode: "dark",
          },
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [base],
  connectors,
  transports: { [base.id]: http(BASE_RPC) },
  ssr: true,
});
