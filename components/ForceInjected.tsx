// components/ForceInjected.tsx
"use client";

import { useConnect } from "wagmi";

export default function ForceInjected({ fullWidth = false }: { fullWidth?: boolean }) {
  const { connectors, connect, isPending, error } = useConnect();

  // Find an injected connector if one exists (MetaMask/Trust/Rabby/Rainbow in-app, etc.)
  const injected = connectors.find((c) => c.type === "injected");

  if (!injected) {
    // Nothing injected in this environment — keep UI clean
    return null;
  }

  return (
    <div className={`mt-2 ${fullWidth ? "w-full" : ""}`}>
      <button
        className={`pill pill-opaque ${fullWidth ? "w-full justify-center" : ""}`}
        disabled={isPending}
        onClick={() => connect({ connector: injected })}
        title="Force use Injected provider"
      >
        {isPending ? "Connecting…" : "Use Injected"}
      </button>

      {error ? (
        <div className="text-warn text-xs mt-1">
          {String(error?.message || error)}
        </div>
      ) : null}
    </div>
  );
}
