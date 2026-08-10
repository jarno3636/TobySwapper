"use client";

import Link from "next/link";
import Image from "next/image";
import ConnectPill from "@/components/ConnectPill";

export default function Brand() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-[rgba(20,28,40,.07)] bg-[rgba(250,250,247,.84)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" prefetch className="flex min-w-0 items-center gap-3 group">
          <span className="brand-medallion relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl">
            <Image src="/tokens/toby.PNG" alt="Toby" fill sizes="44px" className="object-contain p-[2px]" priority />
          </span>
          <span className="min-w-0">
            <span className="block text-[9px] font-extrabold tracking-[.30em] text-inkSub">TOBYWORLD</span>
            <span className="block text-lg font-black tracking-[-.035em] sm:text-xl">TobySwapper</span>
          </span>
        </Link>
        <div className="ml-3 shrink-0"><ConnectPill /></div>
      </div>
    </header>
  );
}
