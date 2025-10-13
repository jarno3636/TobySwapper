// components/Brand.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import ConnectPill from "@/components/ConnectPill";

export default function Brand() {
  return (
    <header className="sticky top-0 z-30 glass-strong border-b border-white/10">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        {/* Logo + title */}
        <Link href="/" prefetch className="flex items-center gap-3 min-w-0 group">
          <span className="relative inline-flex items-center justify-center w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/10 group-hover:ring-white/20 transition">
            <Image
              src="/toby2.PNG"
              alt="Toby"
              fill
              sizes="40px"
              className="object-cover"
              priority
            />
          </span>
          <span className="text-2xl font-extrabold tracking-tight whitespace-nowrap">
            TobySwap
          </span>
        </Link>

        {/* Wallet connect pill (RainbowKit) */}
        <div className="flex items-center gap-2 shrink-0 ml-3 sm:ml-6">
          <ConnectPill />
        </div>
      </div>
    </header>
  );
}
