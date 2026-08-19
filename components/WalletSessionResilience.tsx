"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAccount, useReconnect } from "wagmi";

/**
 * Embedded wallet hosts can suspend an in-app browser while a wallet sheet is open
 * or while Next routes change. Keep the wagmi connector recoverable without polling
 * Base or sending anything through the Vercel origin.
 */
export default function WalletSessionResilience() {
  const { status, address } = useAccount();
  const { reconnect } = useReconnect();
  const lastAttemptRef = useRef(0);

  const recover = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

    if (status === "disconnected") {
      const now = Date.now();
      if (now - lastAttemptRef.current < 8_000) return;
      lastAttemptRef.current = now;
      reconnect();
      return;
    }

    if (status === "connected" && address && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("tobyswap:wallet-session-active", {
          detail: { address, at: Date.now() },
        }),
      );
    }
  }, [address, reconnect, status]);

  useEffect(() => {
    // One recovery attempt after the client provider is mounted.
    const timer = window.setTimeout(recover, 40);
    return () => window.clearTimeout(timer);
  }, [recover]);

  useEffect(() => {
    const onPageShow = () => recover();
    const onVisible = () => {
      if (document.visibilityState === "visible") recover();
    };

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [recover]);

  return null;
}
