// components/Brand.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
} from "wagmi";
import { WalletPill } from "./Wallet";

export default function Brand() {
  const [showDebug, setShowDebug] = useState(false);

  // Open debug by default if env flag is set
  const defaultOpen = useMemo(
    () => process.env.NEXT_PUBLIC_WALLET_DEBUG === "1",
    []
  );
  useEffect(() => {
    if (defaultOpen) setShowDebug(true);
  }, [defaultOpen]);

  // Wagmi hooks for debug panel
  const { address, isConnected, status } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending, error, reset } = useConnect();
  const { disconnect } = useDisconnect();

  const injected = connectors.find((c) => c.id === "injected");
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  const short = (a?: `0x${string}`) =>
    a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";

  const resetWalletCache = () => {
    try {
      // Clear wagmi + any wc leftovers + our price cache keys
      localStorage.clear();
      sessionStorage.clear();
      document.cookie
        .split(";")
        .forEach((c) => {
          const eq = c.indexOf("=");
          const name = eq > -1 ? c.slice(0, eq) : c;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        });
    } catch {}
    location.reload();
  };

  const tryInjected = () => {
    if (!injected) return;
    if (error) reset();
    connect({ connector: injected });
  };

  return (
    <header className="sticky top-0 z-30 glass-strong border-b border-white/10">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        {/* Left: logo + title */}
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
          <span className="text-2xl font-extrabold tracking-tight">
            TobySwap
          </span>
        </Link>

        {/* Right: Connect + Debug toggle */}
        <div className="flex items-center gap-2">
          <WalletPill />
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
          <div className="glass rounded-2xl p-4 shadow-soft text-xs">
            <div className="text-sm font-semibold mb-2">Wallet Debug</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="mb-1">
                  Origin:{" "}
                  <code className="opacity-80">{origin}</code>
                </div>
                <div className="mb-1">
                  Status: <b>{status}</b>
                </div>
                <div className="mb-1">
                  Connected: <b>{isConnected ? "yes" : "no"}</b>
                </div>
                <div className="mb-1">
                  Address: <code>{short(address)}</code>
                </div>
                <div className="mb-2">
                  ChainId: <code>{chainId ?? "—"}</code>
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    className="pill pill-opaque"
                    disabled={!injected || isPending}
                    onClick={tryInjected}
                    title="Connect injected provider"
                  >
                    {isPending ? "Connecting…" : "Try Injected"}
                  </button>
                  {isConnected && (
                    <button
                      className="pill pill-opaque"
                      onClick={() => disconnect()}
                    >
                      Disconnect
                    </button>
                  )}
                </div>

                <button
                  className="pill pill-opaque mt-2"
                  onClick={resetWalletCache}
                  title="Clear wagmi/cache and reload"
                >
                  Reset Wallet Cache
                </button>

                {error ? (
                  <div className="mt-2 text-danger break-words">
                    {String(error?.message || error)}
                  </div>
                ) : null}
              </div>

              <div>
                <div className="text-inkSub mb-1">Detected connectors:</div>
                <ul className="list-disc pl-5 space-y-1">
                  {connectors.map((c) => (
                    <li key={c.uid}>
                      <code className="opacity-90">{c.name}</code>
                      <span className="opacity-60"> — type:</span>{" "}
                      <code className="opacity-90">{c.type}</code>
                      {c.id ? (
                        <>
                          <span className="opacity-60"> · id:</span>{" "}
                          <code className="opacity-90">{c.id}</code>
                        </>
                      ) : null}
                      {"ready" in c ? (
                        <>
                          <span className="opacity-60"> · ready:</span>{" "}
                          <code className="opacity-90">
                            {(c as any).ready ? "true" : "false"}
                          </code>
                        </>
                      ) : null}
                    </li>
                  ))}
                  {connectors.length === 0 ? <li>— none —</li> : null}
                </ul>

                <div className="mt-3 text-[11px] text-inkSub">
                  Tip: If you see <b>No Wallet Detected</b>, open this page
                  inside your wallet’s in-app browser (MetaMask, Coinbase,
                  Rabby, OKX). On desktop, install a wallet extension.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
