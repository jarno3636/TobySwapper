"use client";

import * as React from "react";
import { useAccount, useConnect } from "wagmi";
import { isFarcasterUA } from "@/lib/miniapps";

/**
 * Auto-connects only when inside Farcaster / Warpcast.
 * No async env guessing. No races.
 */
export default function FarcasterMiniAutoConnect() {
  const { status } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const triedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isFarcasterUA()) return;
    if (status === "connected" || status === "connecting") return;
    if (triedRef.current) return;

    const isMini = (c: any) =>
      String(c.id).toLowerCase().includes("mini") ||
      String(c.name || "").toLowerCase().includes("farcaster");

    const mini = connectors.find(isMini);
    const injected = connectors.find((c) => c.id === "injected");

    const target = mini ?? injected ?? connectors[0];
    if (!target) return;

    triedRef.current = true;
    connectAsync({ connector: target }).catch(() => {
      // silent failure; user can still connect manually
    });
  }, [status, connectors, connectAsync]);

  return null;
}
