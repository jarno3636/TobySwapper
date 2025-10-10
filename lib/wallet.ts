// lib/wallet.ts
"use client";

import { createConfig, http, cookieStorage, createStorage } from "wagmi";
import { injected } from "wagmi/connectors";
import { base } from "viem/chains";

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org";

export const wagmiConfig = createConfig({
  chains: [base],
  transports: { [base.id]: http(BASE_RPC) },
  connectors: [
    injected({
      shimDisconnect: true,  // reliable re-connect state
      // no target => supports MetaMask, Rabby, OKX, Coinbase in-app
    }),
  ],
  storage: createStorage({ storage: cookieStorage }), // safe for App Router SSR
  ssr: true,
});
