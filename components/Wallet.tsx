// components/Wallet.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  WagmiProvider,
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { base } from "viem/chains";
import { wagmiConfig } from "@/lib/wallet";

/* ───────────── Providers (client-only, SSR-safe) ───────────── */

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

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const qc = getQueryClient();
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

/* ───────────── Helpers ───────────── */

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

function useOnClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T>,
  handler: () => void
) {
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) handler();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [ref, handler]);
}

/* ───────────── Injected-only Connect Pill with Popover ───────────── */

export function WalletPill() {
  const mounted = useMounted();

  const { address, isConnected, status: accountStatus } = useAccount();
  const chainId = useChainId();

  const {
    connectors,
    connect,
    status: connectStatus, // 'idle' | 'pending' | 'success' | 'error'
    error,
    reset,
  } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: switching } = useSwitchChain();

  const injected = useMemo(
    () => connectors.find((c) => c.id === "injected"),
    [connectors]
  );

  // Auto-connect to injected if available (DApp browsers)
  useEffect(() => {
    if (!mounted) return;
    if (!injected || !(injected as any).ready) return;
    if (isConnected || accountStatus === "reconnecting" || accountStatus === "connecting") return;
    try {
      connect({ connector: injected });
    } catch {
      // some wallets require a user gesture; ignored (user can click Connect)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, injected, isConnected, accountStatus]);

  // Soft switch to Base after connect
  useEffect(() => {
    if (!isConnected) return;
    if (chainId === base.id) return;
    switchChainAsync({ chainId: base.id }).catch(() => {});
  }, [isConnected, chainId, switchChainAsync]);

  // Prevent SSR/CSR mismatch
  if (!mounted) {
    return (
      <button className="pill pill-opaque" style={{ opacity: 0, pointerEvents: "none" }}>
        …
      </button>
    );
  }

  const connecting =
    connectStatus === "pending" ||
    accountStatus === "connecting" ||
    accountStatus === "reconnecting";

  const dotConnected = "bg-[var(--accent)]";   // light blue
  const dotDisconnected = "bg-[var(--danger)]"; // red

  /* ───────────── Popover Menu ───────────── */
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(menuRef, () => setOpen(false));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function copy(addr: string) {
    try {
      await navigator.clipboard.writeText(addr);
    } catch {
      // no-op
    }
  }

  const onConnect = () => {
    if (!injected) return;
    if (error) reset(); // clear stale connect error
    connect({ connector: injected });
    setOpen(false);
  };

  const onDisconnect = () => {
    disconnect();
    setOpen(false);
  };

  const onSwitchBase = () => {
    switchChainAsync({ chainId: base.id }).finally(() => setOpen(false));
  };

  const onMainButton = () => {
    // Toggle popover for both states (connected or not)
    setOpen((v) => !v);
  };

  // Render
  const notDetected = !injected || !(injected as any).ready;

  // Button label & dot
  const label = isConnected
    ? `${address?.slice(0, 6)}…${address?.slice(-4)}`
    : connecting
    ? "Connecting…"
    : notDetected
    ? "No Wallet Detected"
    : "Not Connected";

  const dotClass = isConnected ? dotConnected : dotDisconnected;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={onMainButton}
        className={`pill ${isConnected ? "pill-nav" : "pill-opaque"} ${notDetected ? "opacity-70 cursor-not-allowed" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={notDetected}
        title={isConnected ? "Wallet menu" : notDetected ? "Open in wallet browser or install extension" : "Wallet menu"}
      >
        <span aria-hidden className={`block h-2 w-2 rounded-full ${dotClass}`} />
        <span className="ml-1.5">{label}</span>
      </button>

      {/* Popover */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 min-w-[220px] rounded-2xl glass shadow-soft p-2 z-50"
        >
          {isConnected && address ? (
            <>
              <div className="px-2 py-1.5 text-xs text-inkSub">
                {address}
              </div>
              <button
                role="menuitem"
                className="w-full text-left pill pill-opaque px-3 py-2 text-sm my-1"
                onClick={() => copy(address)}
              >
                Copy Address
              </button>
              {chainId !== base.id && (
                <button
                  role="menuitem"
                  className="w-full text-left pill pill-opaque px-3 py-2 text-sm my-1"
                  onClick={onSwitchBase}
                  disabled={switching}
                  aria-busy={switching}
                >
                  {switching ? "Switching…" : "Switch to Base"}
                </button>
              )}
              <button
                role="menuitem"
                className="w-full text-left pill pill-opaque px-3 py-2 text-sm my-1 text-danger"
                onClick={onDisconnect}
              >
                Disconnect
              </button>
            </>
          ) : notDetected ? (
            <div className="px-2 py-1.5 text-xs text-inkSub">
              No injected wallet detected. Open in a wallet’s in-app browser
              (MetaMask, Coinbase, Rabby, OKX, etc.) or install an extension.
            </div>
          ) : (
            <>
              <div className="px-2 py-1.5 text-xs text-inkSub">
                Injected wallet available.
              </div>
              <button
                role="menuitem"
                className="w-full text-left pill pill-opaque px-3 py-2 text-sm my-1"
                onClick={onConnect}
                disabled={connecting}
                aria-busy={connecting}
              >
                {connecting ? "Connecting…" : "Connect (Injected)"}
              </button>
              <div className="px-2 py-1.5 text-[11px] text-inkSub">
                Tip: if nothing happens, your wallet may require a tap inside its browser.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
