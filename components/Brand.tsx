"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { WalletPill } from "./Wallet";

export default function Brand() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-black/30">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        {/* Left: Toby avatar + big TobySwap */}
        <Link href="/" className="flex items-center gap-3 group">
          <span className="relative inline-flex items-center justify-center w-10 h-10 rounded-full glass overflow-hidden ring-1 ring-white/10 group-hover:ring-white/20 transition">
            <Image src="/toby.PNG" alt="Toby" fill sizes="40px" className="object-cover" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-2xl font-extrabold tracking-tight">TobySwap</span>
            <span className="text-[11px] text-inkSub">Base • 1% auto-burn to $TOBY</span>
          </span>
        </Link>

        {/* Right: Desktop nav + connect */}
        <nav className="hidden md:flex items-center gap-2">
          <Link href="/" className="pill glass hover:opacity-90"><span className="pip pip-a" /> Home</Link>
          <Link href="/about" className="pill glass hover:opacity-90"><span className="pip pip-b" /> About</Link>
          <a href="https://toadgod.xyz" target="_blank" className="pill glass">Site</a>
          <a href="https://x.com/toadgod1017" target="_blank" className="pill glass">X</a>
          <a href="https://t.me/toadgang/212753" target="_blank" className="pill glass">TG</a>
          <WalletPill />
        </nav>

        {/* Mobile: hamburger */}
        <button
          aria-label="Open menu"
          className="md:hidden pill glass"
          onClick={() => setOpen(true)}
        >
          <span className="pip pip-a" /> Menu
        </button>
      </div>

      {/* Slide-over menu */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-[78%] max-w-sm glass border-l border-white/10 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="relative inline-block w-8 h-8 rounded-full overflow-hidden">
                  <Image src="/toby.PNG" alt="Toby" fill sizes="32px" className="object-cover" />
                </span>
                <span className="font-semibold text-lg">TobySwap</span>
              </div>
              <button className="pill glass" onClick={() => setOpen(false)}>Close</button>
            </div>

            <div className="space-y-3">
              <Link href="/" onClick={() => setOpen(false)} className="block pill glass">Home</Link>
              <Link href="/about" onClick={() => setOpen(false)} className="block pill glass">About</Link>
              <a href="https://toadgod.xyz" target="_blank" onClick={() => setOpen(false)} className="block pill glass">Site</a>
              <a href="https://x.com/toadgod1017" target="_blank" onClick={() => setOpen(false)} className="block pill glass">X</a>
              <a href="https://t.me/toadgang/212753" target="_blank" onClick={() => setOpen(false)} className="block pill glass">Telegram</a>
              <div className="pt-2">
                <WalletPill />
              </div>
            </div>
          </aside>
        </div>
      )}
    </header>
  );
}
