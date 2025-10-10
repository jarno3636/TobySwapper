// lib/wallet.ts
"use client";

import { createConfig, http, cookieStorage, createStorage } from "wagmi";
import { base } from "viem/chains";
import { injected } from "wagmi/connectors";

// Optional dedicated RPC (recommended on Vercel)
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org";

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected({
      shimDisconnect: true, // stable disconnect across reloads
    }),
  ],
  transports: {
    [base.id]: http(BASE_RPC),
  },
  // Persist to cookies so SSR hydration never flips state
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  autoConnect: true, // 🔥 restores an injected session automatically
});
