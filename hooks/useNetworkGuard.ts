// hooks/useNetworkGuard.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { base } from "viem/chains";

export function useNetworkGuard() {
  const { chainId, isConnected } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [error, setError] = useState<string | undefined>();

  const onBase = chainId === base.id;

  useEffect(() => {
    setError(undefined);
    if (!isConnected) return;
    if (onBase) return;

    (async () => {
      try {
        await switchChainAsync({ chainId: base.id });
      } catch (e: any) {
        setError(e?.shortMessage || e?.message || "Failed to switch to Base.");
      }
    })();
  }, [isConnected, onBase, switchChainAsync]);

  return useMemo(
    () => ({ onBase, isSwitching: isPending, error }),
    [onBase, isPending, error]
  );
}
