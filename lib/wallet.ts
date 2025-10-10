// lib/wallet.ts
"use client";

import { http, cookieStorage, createStorage } from "wagmi";
import { base } from "viem/chains";
import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors";

/**
 * This config connects automatically to the injected provider
 * (e.g. MetaMask, Coinbase, Base Wallet). It skips all WalletConnect options.
 */
export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected({
      shimDisconnect: true, // keeps state consistent after reload
    }),
  ],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
  },
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
});
