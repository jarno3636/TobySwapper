// components/Brand.tsx
"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { WalletPill, ConnectPill } from "./Wallet";

export default function Brand() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-[rgba(15,15,20,0.95)] backdrop-blur-md border-b border-white/10">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="relative inline-flex w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/10">
            <Image src="/tobyswapper.PNG" alt="Toby" fill sizes="40px" className="object-cover" />
          </span>
        </Link>
        <span className="text-2xl font-extrabold tracking-tight">TobySwap</span>

        <nav className="hidden md:flex items-center gap-2">
          <Link href="/" className="pill bg-white/10 hover:bg-white/15">Home</Link>
          <Link href="/about" className="pill bg-white/10 hover:bg-white/15">About</Link>
          <WalletPill />
        </nav>

        <button
          aria-label="Open menu"
          className="md:hidden pill bg-white/10"
          onClick={() => setOpen(true)}
        >
          Menu
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-[78%] max-w-sm bg-[#0f1117] border-l border-white/10 p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-lg">TobySwap</span>
              <button className="pill bg-white/10" onClick={() => setOpen(false)}>Close</button>
            </div>

            <div className="space-y-3">
              <Link href="/" onClick={() => setOpen(false)} className="block pill bg-white/10">
                Home
              </Link>
              <Link href="/about" onClick={() => setOpen(false)} className="block pill bg-white/10">
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
