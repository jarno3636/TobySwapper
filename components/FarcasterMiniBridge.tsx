'use client';

import * as React from 'react';
import useMiniAppReady from '@/hooks/useMiniAppReady';

/**
 * If we’re inside a Farcaster Mini App and a provider is exposed via SDK/globals,
 * set window.ethereum (non-destructively) so RainbowKit’s injected connector sees it.
 */
export default function FarcasterMiniBridge() {
  const { isInFarcaster } = useMiniAppReady();

  React.useEffect(() => {
    if (!isInFarcaster) return;

    let restored = false;
    const g = window as any;

    // Try multiple well-known spots for a provider
    const candidates = [
      g.ethereum,
      g.farcaster?.miniapp?.ethereum,
      g.farcaster?.ethereum,
      g.farcaster?.provider,
      g.wallet?.provider,
    ].filter(Boolean);

    const picked = candidates[0];

    if (!picked) return;

    // If injected not already present, temporarily bridge it
    if (!g.ethereum) {
      g.ethereum = picked;
      restored = true;
    }

    return () => {
      // If we set it, clean up on unmount
      if (restored) {
        try {
          if (g.ethereum === picked) g.ethereum = undefined;
        } catch {
          /* ignore */
        }
      }
    };
  }, [isInFarcaster]);

  return null;
}
