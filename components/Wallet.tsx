// components/Wallet.tsx
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wallet";

/** ── QueryClient singleton ─────────────────────────────────── */
let _qc: QueryClient | null = null;
function getQueryClient() {
  if (_qc) return _qc;
  _qc = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        gcTime: 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: { retry: 0 },
    },
  });
  return _qc;
}

/** ── Error Boundary: prevents wallet crashes from taking down the page ── */
class WalletErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    // Keep it quiet in prod UI; still log for debugging.
    // eslint-disable-next-line no-console
    console.error("[WalletPill] crashed:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <button
          type="button"
          className="pill pill-opaque"
          onClick={() => this.setState({ hasError: false })}
          title="Reload wallet button"
        >
          <span aria-hidden className="block h-2 w-2 rounded-full bg-[var(--danger)]" />
          <span className="ml-1.5">Not Connected</span>
        </button>
      );
    }
    return this.props.children;
  }
}

/** ── Client-only inner pill (no SSR) ───────────────────────── */
const WalletPillInner = dynamic(() => import("./WalletPillInner"), {
  ssr: false,
  loading: () => (
    <button
      className="pill pill-opaque"
      style={{ opacity: 0.5, pointerEvents: "none" }}
      aria-busy="true"
    >
      <span aria-hidden className="block h-2 w-2 rounded-full bg-white/50" />
      <span className="ml-1.5">Loading…</span>
    </button>
  ),
});

/** ── App provider wrapper ───────────────────────────────────── */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const qc = getQueryClient();
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

/** ── Safe Wallet Pill export ─────────────────────────────────── */
export function WalletPill() {
  return (
    <WalletErrorBoundary>
      <WalletPillInner />
    </WalletErrorBoundary>
  );
}
