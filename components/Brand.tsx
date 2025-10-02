// components/Brand.tsx
"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { WalletPill, ConnectPill } from "./Wallet";

export default function Brand() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <header className="sticky top-0 z-30 glass-strong border-b border-white/10">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        {/* Left: avatar only */}
        <Link href="/" className="flex items-center gap-3 group">
          <span className="relative inline-flex items-center justify-center w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/10 group-hover:ring-white/20 transition">
            <Image src="/toby.PNG" alt="Toby" fill sizes="40px" className="object-cover" />
          </span>
        </Link>

        {/* Center: title only */}
        <span className="text-2xl font-extrabold tracking-tight">TobySwap</span>

        {/* Right: Desktop nav (Home + About) + Connect */}
        <nav className="hidden md:flex items-center gap-2">
          <Link href="/" className="pill pill-nav hover:opacity-90">Home</Link>
          <Link href="/about" className="pill pill-nav hover:opacity-90">About</Link>
          <WalletPill />
        </nav>

        {/* Mobile: hamburger */}
        <button
          aria-label="Open menu"
          className="md:hidden pill pill-opaque"
          onClick={() => setOpen(true)}
        >
          Menu
        </button>
      </div>

      {/* Mobile slide-over (fully opaque) */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Darker, slightly blurred overlay that closes on click */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute right-0 top-0 h-full w-[78%] max-w-sm menu-sheet p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-lg">TobySwap</span>
              <button className="pill pill-opaque" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <div className="space-y-3">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="block pill pill-opaque text-center"
              >
                Home
              </Link>
              <Link
                href="/about"
                onClick={() => setOpen(false)}
                className="block pill pill-opaque text-center"
              >
                About
              </Link>
              <div className="pt-2">
                <ConnectPill onBeforeOpen={() => setOpen(false)} />
              </div>
            </div>
          </aside>
        </div>
      )}
    </header>
  );
}
