// components/inx
"use client";

import { useEffect, useMemo } from "react";
import { useConnect } from "wagmi";

export default function WalletDebug() {
  const { connectors } = useConnect();

  // Read WC project id that actually reached the browser bundle
  const WC = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";

  const rows = useMemo(
    () =>
      connectors.map((c) => ({
        name: c.name,
        id: c.id,
        type: (c as any).type ?? "unknown",
        ready: c.ready, // injected is false if window.ethereum missing
      })),
    [connectors]
  );

  useEffect(() => {
    // Helpful console visibility
    console.table(rows);
    if (!WC) {
      console.warn(
        "WalletConnect is disabled because NEXT_PUBLIC_WC_PROJECT_ID is empty in the client bundle."
      );
    }
    if (typeof window !== "undefined") {
      console.log("Origin:", window.location.origin);
    }
  }, [rows, WC]);

  return (
    <div className="glass rounded-xl p-3 text-xs mt-2">
      <div className="font-semibold mb-1">Wallet Debug</div>
      <div>WC Project ID present: <code>{WC ? "yes" : "no"}</code></div>
      <div className="mt-1">Detected connectors:</div>
      <ul className="list-disc ml-5 mt-1 space-y-1">
        {rows.map((r) => (
          <li key={r.id}>
            <b>{r.name}</b> — type: <code>{r.type}</code> · id:
            <code>{r.id}</code> · ready: <code>{String(r.ready)}</code>
          </li>
        ))}
      </ul>
      <div className="mt-2 text-inkSub">
        Tip: <b>Injected</b> only appears when a wallet extension is installed or you’re inside a wallet’s in-app browser.
        WalletConnect appears only when <code>NEXT_PUBLIC_WC_PROJECT_ID</code> is set <i>and</i> your domain is whitelisted in WC Cloud.
      </div>
    </div>
  );
}
