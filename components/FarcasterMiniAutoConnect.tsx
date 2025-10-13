'use client';
import * as React from 'react';
import { useAccount, useConnect } from 'wagmi';
import useMiniAppReady from '@/hooks/useMiniAppReady';

/**
 * Auto-connects only when inside Farcaster.
 * Prefers the official Farcaster Mini-App connector; falls back to injected.
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

    const isMini = (c: any) =>
      String(c.id).toLowerCase().includes('mini') ||
      String(c.name || '').toLowerCase().includes('farcaster');

    const mini = connectors.find(isMini);
    const injected = connectors.find((c) => c.id === 'injected');

    const target = mini ?? injected ?? connectors[0];
    if (!target) return;

    triedRef.current = true;
    connectAsync({ connector: target }).catch(() => {
      // stay silent; user can still connect manually
    });
  }, [isInFarcaster, status, connectors, connectAsync]);

  return null;
}
