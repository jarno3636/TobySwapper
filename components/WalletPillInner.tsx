// components/WalletPillInner.tsx
"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { base } from "viem/chains";

/** Hydration guard */
function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** Small helper */
async function safeClipboardCopy(text?: string) {
  try {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

/** The pill */
export default function WalletPillInner() {
  const mounted = useMounted();

  const { address, isConnected, status: accountStatus } = useAccount();
  const chainId = useChainId();

  const { connectors = [], connect, status: connectStatus, error, reset } =
    useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: switching } = useSwitchChain();

  // Prefer injected; else first connector (if any)
  const injected = useMemo(
    () => connectors.find((c) => c.id === "injected") ?? null,
    [connectors]
  );
  const fallback = useMemo(
    () => injected ?? (connectors.length ? connectors[0] : null),
    [injected, connectors]
  );

  // Soft switch to Base after connect
  useEffect(() => {
    if (!isConnected || chainId === base.id) return;
    (async () => {
      try {
        await switchChainAsync({ chainId: base.id });
      } catch {
        /* ignore */
      }
    })();
  }, [isConnected, chainId, switchChainAsync]);

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

  const label = isConnected
    ? `${address?.slice(0, 6)}…${address?.slice(-4)}`
    : connecting
    ? "Connecting…"
    : "Not Connected";

  const dotClass = isConnected ? "bg-[var(--accent)]" : "bg-[var(--danger)]";

  // Popover (no <details>, fully controlled)
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      const t = e.target as Node | null;
      if (!menuRef.current.contains(t)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const safeConnect = async () => {
    try {
      if (error) reset();
      if (!fallback) return; // nothing available to connect
      await connect({ connector: fallback });
    } catch {
      // swallow errors to avoid crashing the app
    }
  };

  const onMainClick = async () => {
    if (!isConnected) {
      if (!connecting) await safeConnect();
    } else {
      setOpen((v) => !v);
    }
  };

  const onCopy = async () => {
    await safeClipboardCopy(address);
    setOpen(false);
  };

  const onSwitchBase = async () => {
    try {
      await switchChainAsync({ chainId: base.id });
    } catch {}
    setOpen(false);
  };

  const onDisconnect = () => {
    try {
      disconnect();
    } catch {}
    setOpen(false);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={onMainClick}
        className={["pill", isConnected ? "pill-nav" : "pill-opaque"].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={isConnected ? "Wallet menu" : "Connect wallet"}
        disabled={connecting}
      >
        <span aria-hidden className={`block h-2 w-2 rounded-full ${dotClass}`} />
        <span className="ml-1.5">{label}</span>
      </button>

      {open && isConnected && (
        <div
          role="menu"
          className="absolute right-0 mt-2 min-w-[220px] rounded-2xl glass shadow-soft p-2 z-50"
        >
          <div className="px-2 py-1.5 text-xs text-inkSub break-all">{address}</div>

          <button
            role="menuitem"
            className="w-full text-left pill pill-opaque px-3 py-2 text-sm my-1"
            onClick={onCopy}
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
        </div>
      )}
    </div>
  );
}
