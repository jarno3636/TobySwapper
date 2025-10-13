'use client';
import * as React from 'react';
import { useAccount, useConnect } from 'wagmi';
import useMiniAppReady from '@/hooks/useMiniAppReady';

/**
 * Auto-connects the injected connector only when inside Farcaster.
 */
export default function FarcasterMiniAutoConnect() {
  const { isInFarcaster } = useMiniAppReady();
  const { status } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const triedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isInFarcaster) return;
    if (status === 'connected' || status === 'connecting') return;
    if (triedRef.current) return;

    const injected =
      connectors.find((c) => c.id === 'injected') ??
      connectors[0]; // fall back to first available

    if (!injected) return;

    triedRef.current = true;
    // Promise-based connect
    connectAsync({ connector: injected }).catch(() => {
      // stay quiet; user can still connect manually
    });
  }, [isInFarcaster, status, connectors, connectAsync]);

  return null;
}
