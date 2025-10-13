'use client';

import type { ReactNode } from 'react';
import useMiniAppReady from '@/hooks/useMiniAppReady';

export default function MiniAppGate({ children }: { children: ReactNode }) {
  const { isReady } = useMiniAppReady();
  if (!isReady) return null;
  return <>{children}</>;
}
