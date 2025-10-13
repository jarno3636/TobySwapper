'use client';

import { ReactNode } from 'react';
import useMiniAppReady from '@/hooks/useMiniAppReady';

export default function MiniAppGate({ children }: { children: ReactNode }) {
  const { isReady } = useMiniAppReady();
  if (!isReady) return null; // prevents “half rendered” flash below splash
  return <>{children}</>;
}
