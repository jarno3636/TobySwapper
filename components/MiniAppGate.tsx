"use client";

import { ReactNode } from "react";

/**
 * Lightweight wrapper for Mini Apps.
 * Keeps structure stable without async env checks.
 */
export default function MiniAppGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
