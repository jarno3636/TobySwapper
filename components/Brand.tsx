"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { WalletPill } from "./Wallet";

export default function Brand() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[rgba(15,15,20,0.95)] backdrop-blur-md border-b border-white/10">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        {/* Left: avatar + TobySwap */}
        <Link href="/" className="flex items-center gap-3">
          <span className="relative inline-flex items-center justify-center w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/10">
            <Image src="/toby.PNG" alt="TobySwap" fill sizes="40px" className="object-cover" />
          </span>
          <span className="text-2xl font-extrabold tracking-tight">TobySwap</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-2">
          <Link href="/" className="pill glass">Home</Link>
          <Link href="/about" className="pill glass">About</Link>
          <WalletPill />
        </nav>

        {/* Mobile menu button */}
        <button aria-label="Open menu" className="md:hidden pill glass" onClick={() => setOpen(true)}>
          Menu
        </button>
      </div>

      {/* Mobile slide-over */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-[78%] max-w-sm bg-[rgba(15,15,20,0.97)] backdrop-blur-md border-l border-white/10 p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-lg">TobySwap</span>
              <button className="pill glass" onClick={() => setOpen(false)}>Close</button>
            </div>
            <div className="space-y-3">
              <Link href="/" onClick={() => setOpen(false)} className="block pill glass">Home</Link>
              <Link href="/about" onClick={() => setOpen(false)} className="block pill glass">About</Link>
              <div className="pt-2"><WalletPill /></div>
            </div>
          </aside>
        </div>
      )}
    </header>
  );
}
