// components/Brand.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useConnect } from "wagmi";
import { WalletPill } from "./Wallet";
import ForceInjected from "./ForceInjected";

export default function Brand() {
  const [showDebug, setShowDebug] = useState(false);

  // Optional: env flag to show debug open by default in preview builds
  const defaultOpen = useMemo(
    () => process.env.NEXT_PUBLIC_WALLET_DEBUG === "1",
    []
  );

  // Initialize with env once (don’t re-open on re-renders)
  useMemo(() => {
    if (defaultOpen) setShowDebug(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connector inspector
  const { connectors } = useConnect();

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

          {/* Debug toggle (only visible in builds where you want it) */}
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

            {/* Force Injected button (appears only if an injected provider is detected) */}
            <ForceInjected />

            {/* Connectors Inspector */}
            <div className="mt-3 text-xs">
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
                  </li>
                ))}
                {connectors.length === 0 ? <li>— none —</li> : null}
              </ul>
            </div>

            <div className="mt-3 text-[11px] text-inkSub">
              Tip: If Injected doesn’t show up, confirm you’re opening this page
              **inside** a wallet’s in-app browser (MetaMask/Trust/Rabby/Rainbow),
              and that WalletConnect Cloud has your domain in Allowed Origins.
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
