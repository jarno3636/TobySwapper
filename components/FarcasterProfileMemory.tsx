"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { getMiniSdk, isInFarcasterMiniApp } from "@/lib/miniapps";

function safeUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export default function FarcasterProfileMemory() {
  const { address, isConnected } = useAccount();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!isConnected || !address) return;
      if (!(await isInFarcasterMiniApp()) || cancelled) return;

      try {
        const sdk = await getMiniSdk();
        if (!sdk || cancelled) return;

        const rawContext = (sdk as any).context;
        const context = typeof rawContext === "function" ? await rawContext() : await rawContext;
        const user = context?.user;
        if (!user?.fid || cancelled) return;

        await fetch("/api/profile/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: address,
            fid: Number(user.fid),
            username: typeof user.username === "string" ? user.username : undefined,
            displayName: typeof user.displayName === "string" ? user.displayName : undefined,
            pfpUrl: safeUrl(user.pfpUrl),
          }),
        });
      } catch {
        // Cosmetic profile memory must never block swapping or Mini App startup.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, isConnected]);

  return null;
}
