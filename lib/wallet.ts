// lib/wallet.ts
"use client";

import { createConfig, http } from "wagmi";
import { base } from "viem/chains";

// Use wagmi's first-party connectors (RainbowKit v2 is happy with these)
import { injected } from "wagmi/connectors";
import { walletConnect } from "wagmi/connectors";
import { coinbaseWallet } from "wagmi/connectors";

// ENV
const WC_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || ""; // REQUIRED for WalletConnect wallets to appear
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org";

// Build a stable, explicit connector list.
// - Injected: shows up whenever window.ethereum exists (MetaMask, Brave, Rabby, OKX ext, in-app browsers).
// - Coinbase: deep-links to CB/Base Wallet (works even without WalletConnect).
// - WalletConnect: shows *if and only if* WC_ID is present; supports dozens of wallets.
const connectors = [
  injected({
    shimDisconnect: true,           // keeps Disconnect state reliable across reloads
    target: "metaMask",             // prefer MetaMask if multiple injecteds; still falls back gracefully
  }),
  coinbaseWallet({
    appName: "Toby Swapper",
    preference: "all",              // show QR + deep link options
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
        }),
      ]
    : []),
];

// Final wagmi config (RainbowKit will infer wallets from these connectors)
export const wagmiConfig = createConfig({
  chains: [base],
  connectors,
  transports: {
    [base.id]: http(BASE_RPC),
  },
  ssr: true,
});
