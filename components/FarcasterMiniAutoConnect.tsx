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
  const { connectors, connect } = useConnect();

  React.useEffect(() => {
    if (!isInFarcaster) return;
    if (status === 'connected' || status === 'connecting') return;
    const injected = connectors.find((c) => c.id === 'injected');
    if (!injected) return;
    connect({ connector: injected }).catch(() => {});
  }, [isInFarcaster, status, connectors, connect]);

  return null;
}
