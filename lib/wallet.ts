// lib/wallet.ts
"use client";

import { http, cookieStorage, createStorage, createConfig } from "wagmi";
import { base } from "viem/chains";
import { injected } from "wagmi/connectors";
import { coinbaseWallet } from "wagmi/connectors";
import { walletConnect } from "wagmi/connectors"; // optional, guarded by env

const WC_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org";

const connectors = [
  // 1) Coinbase (works best inside the Coinbase Wallet browser)
  coinbaseWallet({
    appName: "Toby Swapper",
    preference: "all", // deep link + QR when opened in a normal browser
  }),

  // 2) Generic injected (MetaMask, Rabby, OKX, *and* Coinbase’s injected shim)
  injected({
    shimDisconnect: true,
    // target: "metaMask" // don’t force; let CB/Rabby/MetaMask pick
  }),

  // 3) Optional WalletConnect (kept for desktop/mobile QR)
  ...(WC_ID
    ? [
        walletConnect({
          projectId: WC_ID,
          metadata: {
            name: "Toby Swapper",
            description: "Swap on Base with 1% auto-burn to $TOBY",
            url: "https://tobyswap.vercel.app",
            icons: ["https://tobyswap.vercel.app/og.PNG"],
          },
          showQrModal: true,
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(BASE_RPC),
  },
  connectors,
  storage: createStorage({ storage: cookieStorage }), // SSR-safe
  ssr: true,
});
