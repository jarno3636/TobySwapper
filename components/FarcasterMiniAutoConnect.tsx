'use client';

import * as React from 'react';
import { useAccount, useConnect } from 'wagmi';
import useMiniAppReady from '@/hooks/useMiniAppReady';

/**
 * When inside Farcaster, attempt a silent connect with the injected connector
 * (which now points at the Mini provider thanks to FarcasterMiniBridge).
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

    connect({ connector: injected }).catch(() => {
      // stay quiet; user can still use your normal Connect button
    });
  }, [isInFarcaster, status, connectors, connect]);

  return null;
}
