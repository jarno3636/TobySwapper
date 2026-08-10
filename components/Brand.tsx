"use client";

import Link from "next/link";
import Image from "next/image";
import ConnectPill from "@/components/ConnectPill";

export default function Brand() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-[var(--line)] bg-[rgba(250,249,246,.88)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" prefetch className="flex min-w-0 items-center gap-3 group">
          <span className="relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-[0_4px_0_rgba(20,24,35,.08)]">
            <Image src="/toby2.PNG" alt="Toby" fill sizes="44px" className="object-cover" priority />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold tracking-[.28em] text-inkSub">TOBYWORLD</span>
            <span className="block text-xl font-black tracking-tight">TobySwapper</span>
          </span>
        </Link>
        <div className="ml-3 shrink-0"><ConnectPill /></div>
      </div>
    </header>
  );
}
