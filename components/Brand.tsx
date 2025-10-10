// components/Brand.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useConnect } from "wagmi";
import { WalletPill, ForceInjectedButton, ForceWalletConnectButton, ResetWalletCacheButton } from "./Wallet";

export default function Brand() {
  const [showDebug, setShowDebug] = useState(false);
  const defaultOpen = useMemo(
    () => process.env.NEXT_PUBLIC_WALLET_DEBUG === "1",
    []
  );
  useMemo(() => {
    if (defaultOpen) setShowDebug(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { connectors } = useConnect();

  return (
    <header className="sticky top-0 z-30 glass-strong border-b border-white/10">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        <Link href="/" prefetch className="flex items-center gap-3 group">
          <span className="relative inline-flex items-center justify-center w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/10 group-hover:ring-white/20 transition">
            <Image src="/toby2.PNG" alt="Toby" fill sizes="40px" className="object-cover" />
          </span>
          <span className="text-2xl font-extrabold tracking-tight">TobySwap</span>
        </Link>

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

      {showDebug && (
        <div className="mx-auto max-w-5xl px-4 pb-4">
          <div className="glass rounded-2xl p-4 shadow-soft">
            <div className="text-sm font-semibold mb-2">Wallet Debug</div>

            <div className="text-xs mb-2">
              WC Project ID present:{" "}
              <b>{process.env.NEXT_PUBLIC_WC_PROJECT_ID ? "yes" : "no"}</b>
              <br />
              Origin: <code>{typeof window !== "undefined" ? window.location.origin : "—"}</code>
            </div>

            <div className="flex gap-2 flex-wrap">
              <ForceInjectedButton />
              <ForceWalletConnectButton />
              <ResetWalletCacheButton />
            </div>

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
                    {" · "}
                    <span className={c.ready ? "text-success" : "text-danger"}>
                      {c.ready ? "ready:true" : "ready:false"}
                    </span>
                  </li>
                ))}
                {connectors.length === 0 ? <li>— none —</li> : null}
              </ul>
            </div>

            <div className="mt-3 text-[11px] text-inkSub">
              Tips:
              <ul className="list-disc pl-4 mt-1 space-y-1">
                <li>Injected only appears if a wallet is installed or you’re in a wallet’s in-app browser.</li>
                <li>WalletConnect requires a valid <code>NEXT_PUBLIC_WC_PROJECT_ID</code> and your domain in WC Cloud <i>Allowed Origins</i>.</li>
                <li>If a connector shows <code>ready:false</code>, the runtime can’t use it in this environment.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
