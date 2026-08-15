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
  Connector,
} from "wagmi";
import { base } from "viem/chains";
import { getMiniSdk, isInFarcasterMiniApp } from "@/lib/miniapps";

/** Hydration guard */
function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** UA hint for Warpcast (best-effort only) */
function isFarcasterUA() {
  if (typeof navigator === "undefined") return false;
  return /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent);
}

/** Pick the best connector for this environment */
function choosePreferredConnector(list: readonly Connector[] = []): Connector | null {
  // 1) Farcaster Mini-App connector (id is typically 'farcasterMiniApp')
  const mini = list.find((c) => c.id.toLowerCase().includes("farcaster"));
  if (mini && isFarcasterUA()) return mini;

  // 2) Coinbase-injected first (helps Base / CB Smart Wallet)
  const cbInjected = list.find(
    (c) => c.id === "injected" && c.name.toLowerCase().includes("coinbase")
  );
  if (cbInjected) return cbInjected;

  // 3) Generic injected (Metamask / Rabby / etc.)
  const injected = list.find((c) => c.id === "injected");
  if (injected) return injected;

  // 4) WalletConnect QR (if configured in wagmiConfig)
  const wc = list.find((c) => c.id.toLowerCase().includes("walletconnect"));
  if (wc) return wc;

  // 5) Coinbase Wallet connector
  const cbw = list.find((c) => c.id.toLowerCase().includes("coinbasewallet"));
  if (cbw) return cbw;

  // Fallback: first available
  return list[0] ?? null;
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

type FarcasterIdentity = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
};

/** The pill */
export default function WalletPillInner() {
  const mounted = useMounted();

  const { address, isConnected, status: accountStatus } = useAccount();
  const chainId = useChainId();

  const { connectors = [], connect, connectAsync, status: connectStatus, error, reset } = useConnect();
  const { disconnect, disconnectAsync } = useDisconnect();
  const { switchChainAsync, isPending: switching } = useSwitchChain();

  // Prefer best connector for the current environment
  const preferred = useMemo(() => choosePreferredConnector(connectors), [connectors]);

  const [farcaster, setFarcaster] = useState<FarcasterIdentity | null>(null);
  const [changingWallet, setChangingWallet] = useState(false);

  // Prefer the signed-in Farcaster Mini App identity. On the regular web/Base
  // surface, fall back to a server-side wallet -> Farcaster lookup when Neynar
  // is configured. The wallet still signs every transaction; this is display only.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isConnected || !address) {
        if (!cancelled) setFarcaster(null);
        return;
      }

      try {
        if (await isInFarcasterMiniApp()) {
          const sdk = await getMiniSdk();
          const rawContext = (sdk as any)?.context;
          const context = typeof rawContext === "function" ? await rawContext() : await rawContext;
          const user = context?.user;
          if (!cancelled && user?.fid) {
            setFarcaster({
              fid: Number(user.fid),
              username: typeof user.username === "string" ? user.username : undefined,
              displayName: typeof user.displayName === "string" ? user.displayName : undefined,
              pfpUrl: typeof user.pfpUrl === "string" ? user.pfpUrl : undefined,
            });
            return;
          }
        }
      } catch {
        // Continue to the address resolver below.
      }

      try {
        const response = await fetch(`/api/farcaster/identity?address=${encodeURIComponent(address)}`, { cache: "no-store" });
        const payload = await response.json();
        if (!cancelled && response.ok && payload?.profile?.fid) setFarcaster(payload.profile);
      } catch {
        // Identity enrichment must never interfere with wallet connectivity.
      }
    })();
    return () => { cancelled = true; };
  }, [address, isConnected]);

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

  const walletLabel = `${address?.slice(0, 6)}…${address?.slice(-4)}`;
  const socialLabel = farcaster?.username
    ? `@${farcaster.username}`
    : farcaster?.displayName || walletLabel;
  const label = isConnected ? socialLabel : connecting ? "Connecting…" : "Not Connected";

  const dotClass = isConnected ? "bg-[var(--accent)]" : "bg-[var(--danger)]";

  const safeConnect = async () => {
    try {
      if (error) reset();
      if (!preferred) return; // nothing available to connect
      await connect({ connector: preferred });
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

  const onChangeWallet = async () => {
    if (changingWallet || connecting) return;
    setChangingWallet(true);
    setFarcaster(null);
    setOpen(false);
    try {
      // Tear down Wagmi's cached connection first, then ask the active wallet
      // provider for accounts again. This is important when the user changes
      // accounts inside the host wallet while the mini app remains open.
      await disconnectAsync();
      await new Promise((resolve) => setTimeout(resolve, 180));
      if (preferred) await connectAsync({ connector: preferred });
      // A hard refresh clears any token/NFT query cache tied to the old address.
      if (typeof window !== "undefined") window.location.reload();
    } catch {
      setChangingWallet(false);
    }
  };

  const onDisconnect = () => {
    try {
      disconnect();
      setFarcaster(null);
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
        {isConnected ? (
          <img
            src={farcaster?.pfpUrl || "/tokens/toby.PNG"}
            alt=""
            aria-hidden="true"
            className="h-7 w-7 rounded-full object-cover ring-2 ring-white shadow-sm bg-white"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span aria-hidden className={`block h-2 w-2 rounded-full ${dotClass}`} />
        )}
        <span className="ml-1.5 max-w-[132px] truncate font-semibold">{label}</span>
      </button>

      {open && isConnected && (
        <div
          role="menu"
          className="absolute right-0 mt-2 min-w-[220px] rounded-2xl glass shadow-soft p-2 z-50"
        >
          {farcaster && (
            <div className="flex items-center gap-2 px-2 py-2">
              {farcaster.pfpUrl && (
                <img src={farcaster.pfpUrl} alt="" className="h-10 w-10 rounded-xl object-cover" referrerPolicy="no-referrer" />
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-ink">{farcaster.displayName || `@${farcaster.username}`}</div>
                {farcaster.username && <div className="truncate text-xs text-inkSub">@{farcaster.username} · FID {farcaster.fid}</div>}
              </div>
            </div>
          )}
          <div className="px-2 py-1.5 text-xs text-inkSub break-all">{address}</div>

          <button
            role="menuitem"
            className="w-full text-left pill pill-opaque px-3 py-2 text-sm my-1"
            onClick={onChangeWallet}
            disabled={changingWallet}
          >
            {changingWallet ? "Changing wallet…" : "Change wallet"}
          </button>

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
