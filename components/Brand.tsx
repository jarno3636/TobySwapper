// components/Brand.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useConnect } from "wagmi";
import { WalletPill } from "./Wallet";
import ForceInjected from "./ForceInjected";

export default function Brand() {
  const [showDebug, setShowDebug] = useState(false);

  // One-time open based on env (handy for previews)
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_WALLET_DEBUG === "1") {
      setShowDebug(true);
    }
  }, []);

  // Connector inspector
  const { connectors } = useConnect();

  const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
  const origin =
    typeof window !== "undefined" ? window.location.origin : "— (ssr) —";

  const connectorRows = useMemo(
    () =>
      connectors.map((c) => ({
        uid: c.uid,
        name: c.name,
        id: c.id,
        type: (c as any).type ?? "unknown",
        ready: (c as any).ready ?? undefined,
      })),
    [connectors]
  );

  // Quick “reset” commonly fixes stuck WC sessions / shim states
  const resetWalletCache = () => {
    try {
      if (typeof window === "undefined") return;
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (
          k.startsWith("wagmi.") || // wagmi persisted state
          k.startsWith("wc@2") ||   // walletconnect v2
          k.startsWith("walletconnect") ||
          k.startsWith("rainbowkit.")
        ) {
          localStorage.removeItem(k);
        }
      }
      // Also clear sessionStorage WC leftovers
      const sKeys = Object.keys(sessionStorage);
      for (const k of sKeys) {
        if (k.startsWith("wc@2") || k.startsWith("walletconnect")) {
          sessionStorage.removeItem(k);
        }
      }
      // Soft UX ping
      alert("Wallet cache cleared. Reload the page and try connecting again.");
    } catch {
      // ignore
    }
  };

  return (
    <header className="sticky top-0 z-30 glass-strong border-b border-white/10">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        {/* Left: logo + title acts as Home link */}
        <Link href="/" prefetch className="flex items-center gap-3 group">
          <span className="relative inline-flex items-center justify-center w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/10 group-hover:ring-white/20 transition">
            <Image
              src="/toby2.PNG"
              alt="Toby"
              fill
              sizes="40px"
              className="object-cover"
            />
          </span>
          <span className="text-2xl font-extrabold tracking-tight">TobySwap</span>
        </Link>

        {/* Right: connect / manage / disconnect + debug */}
        <div className="flex items-center gap-2">
          <WalletPill />

          {/* Debug toggle (only visible if you keep it) */}
          <button
            type="button"
            className="pill pill-opaque px-3 py-1 text-xs"
            onClick={() => setShowDebug((v) => !v)}
            title="Toggle wallet debug"
          >
            {showDebug ? "Hide Debug" : "Debug"}
          </button>
        </div>
      </div>

      {/* Debug drawer */}
      {showDebug && (
        <div className="mx-auto max-w-5xl px-4 pb-4">
          <div className="glass rounded-2xl p-4 shadow-soft">
            <div className="text-sm font-semibold mb-2">Wallet Debug</div>

            {/* Quick environment + origin */}
            <div className="grid gap-2 sm:grid-cols-2 text-xs">
              <div>
                <div className="text-inkSub">WC Project ID present:</div>
                <div><code>{wcProjectId ? "yes" : "no"}</code></div>
              </div>
              <div>
                <div className="text-inkSub">Origin:</div>
                <div className="break-all"><code>{origin}</code></div>
              </div>
            </div>

            {/* Force Injected button (appears only if an injected provider is detected) */}
            <div className="mt-3">
              <ForceInjected />
            </div>

            {/* Connectors Inspector */}
            <div className="mt-3 text-xs">
              <div className="text-inkSub mb-1">Detected connectors:</div>
              <ul className="list-disc pl-5 space-y-1">
                {connectorRows.map((r) => (
                  <li key={r.uid}>
                    <code className="opacity-90">{r.name}</code>
                    <span className="opacity-60"> — type:</span>{" "}
                    <code className="opacity-90">{r.type}</code>
                    {r.id ? (
                      <>
                        <span className="opacity-60"> · id:</span>{" "}
                        <code className="opacity-90">{r.id}</code>
                      </>
                    ) : null}
                    {typeof r.ready === "boolean" ? (
                      <>
                        <span className="opacity-60"> · ready:</span>{" "}
                        <code className="opacity-90">{String(r.ready)}</code>
                      </>
                    ) : null}
                  </li>
                ))}
                {connectorRows.length === 0 ? <li>— none —</li> : null}
              </ul>
            </div>

            {/* Cache reset helper */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="pill pill-opaque px-3 py-1 text-xs"
                onClick={resetWalletCache}
                title="Clear wagmi / WalletConnect local cache"
              >
                Reset Wallet Cache
              </button>
              <span className="text-[11px] text-inkSub">
                Clears wagmi / WalletConnect storage. Then refresh and try again.
              </span>
            </div>

            <div className="mt-3 text-[11px] text-inkSub">
              Tips:
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li>
                  <b>Injected</b> only appears if a wallet extension is installed
                  or you’re inside a wallet’s in-app browser.
                </li>
                <li>
                  <b>WalletConnect</b> requires{" "}
                  <code>NEXT_PUBLIC_WC_PROJECT_ID</code> and your domain in WC Cloud{" "}
                  <em>Allowed Origins</em> (add your production & preview URLs).
                </li>
                <li>
                  If a connector shows <code>ready: false</code>, the runtime can’t use it in this environment.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
