// components/Wallet.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { base } from "viem/chains";

/** Simple mounted flag to avoid SSR/CSR mismatch */
function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export function WalletPill() {
  const mounted = useMounted();

  const { address, isConnected, isReconnecting } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending, error, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const injected = useMemo(
    () => connectors.find((c) => c.id === "injected"),
    [connectors]
  );

  // 1) Auto-connect to Injected when available & not already connected
  useEffect(() => {
    if (!mounted) return;
    if (!injected || !(injected as any).ready) return;
    if (isConnected || isReconnecting) return;

    try {
      connect({ connector: injected });
    } catch {
      /* some wallets require user gesture; ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, injected, isConnected, isReconnecting]);

  // 2) Auto-switch to Base once connected (silent best-effort)
  useEffect(() => {
    if (!isConnected) return;
    if (chainId === base.id) return;
    // ignore failures quietly; some wallets block auto-switch
    switchChainAsync({ chainId: base.id }).catch(() => {});
  }, [isConnected, chainId, switchChainAsync]);

  if (!mounted) return null;

  // Not detecting a wallet provider at all
  if (!injected || !(injected as any).ready) {
    return (
      <button
        type="button"
        className="pill pill-opaque opacity-70 cursor-not-allowed"
        title="Open in your wallet's in-app browser or install a wallet extension"
        aria-disabled="true"
      >
        No Wallet Detected
      </button>
    );
  }

  // Connected state
  if (isConnected) {
    const short =
      address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Wallet";
    return (
      <button
        type="button"
        className="pill pill-nav"
        onClick={() => disconnect()}
        title="Disconnect wallet"
      >
        {short} (Disconnect)
      </button>
    );
  }

  // Disconnected state — use isPending only (no status === "pending")
  const label = isPending ? "Connecting…" : "Connect";

  return (
    <button
      type="button"
      className="pill pill-opaque"
      disabled={isPending}
      onClick={() => {
        if (error) reset();
        connect({ connector: injected });
      }}
      title="Connect injected wallet"
    >
      {label}
    </button>
  );
}

/** Provider wrapper (unchanged) */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  // Provider is in your layout: WagmiProvider + QueryClientProvider already set there
  return <>{children}</>;
}
