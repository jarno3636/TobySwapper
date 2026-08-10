"use client";

import * as React from "react";
import { useAccount, useConnect } from "wagmi";
import { isInFarcasterMiniApp } from "@/lib/miniapps";

/** Connect the Farcaster wallet only when the SDK confirms a Mini App host. */
export default function FarcasterMiniAutoConnect() {
  const { status } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const triedRef = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (status === "connected" || status === "connecting" || triedRef.current) return;
      if (!(await isInFarcasterMiniApp()) || cancelled) return;

      const mini = connectors.find((c: any) =>
        String(c.id).toLowerCase().includes("mini") ||
        String(c.name || "").toLowerCase().includes("farcaster")
      );
      if (!mini) return;

      triedRef.current = true;
      try { await connectAsync({ connector: mini }); } catch {}
    })();
    return () => { cancelled = true; };
  }, [status, connectors, connectAsync]);

  return null;
}
