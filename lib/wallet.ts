"use client";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { base } from "viem/chains";

export const wagmiConfig = getDefaultConfig({
  appName: process.env.NEXT_PUBLIC_PROJECT_NAME || "Toby Swapper",
  projectId: "toby-swapper", // local-only; for WalletConnect V2 a real ID is recommended
  chains: [base],
  transports: { [base.id]: http(process.env.NEXT_PUBLIC_RPC_BASE) },
});
