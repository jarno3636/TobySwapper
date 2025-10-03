// components/Brand.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { WalletPill } from "./Wallet";

export default function Brand() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <header className="sticky top-0 z-30 glass-strong border-b border-white/10">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        {/* Left: logo + title (link home) */}
        <Link href="/" className="flex items-center gap-3 group" prefetch>
          <span className="relative inline-flex items-center justify-center w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/10 group-hover:ring-white/20 transition">
            <Image src="/toby2.PNG" alt="Toby" fill sizes="40px" className="object-cover" />
          </span>
          <span className="text-2xl font-extrabold tracking-tight">TobySwap</span>
        </Link>

        {/* Right: wallet (consistent pill styling whether connected or not) */}
        <WalletPill />
      </div>
    </header>
  );
}
