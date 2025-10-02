"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WalletPill, ConnectPill } from "./Wallet";

export default function Brand() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <header className="sticky top-0 z-30 glass-strong border-b border-white/10">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        {/* Left: avatar only */}
        <Link href="/" prefetch={false} className="flex items-center gap-3 group">
          <span className="relative inline-flex items-center justify-center w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/10 group-hover:ring-white/20 transition">
            <Image src="/toby2.PNG" alt="Toby" fill sizes="40px" className="object-cover" />
          </span>
        </Link>

        {/* Center: title only */}
        <span className="text-2xl font-extrabold tracking-tight">TobySwap</span>

        {/* Right: Desktop nav + Connect (buttons ensure nav even if pointer-events get funky) */}
        <nav className="hidden md:flex items-center gap-2">
          <button type="button" onClick={() => go("/")} className="pill pill-nav hover:opacity-90">
            Home
          </button>
          <button
            type="button"
            onClick={() => go("/about")}
            className="pill pill-nav hover:opacity-90"
            aria-label="Go to About"
          >
            About
          </button>
          <WalletPill />
        </nav>

        {/* Mobile: hamburger */}
        <button
          aria-label="Open menu"
          className="md:hidden pill pill-opaque"
          onClick={() => setOpen(true)}
          type="button"
        >
          Menu
        </button>
      </div>

      {/* Mobile slide-over (opaque), overlay uses your .menu-overlay to keep background visible */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="menu-overlay absolute inset-0" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-[78%] max-w-sm menu-sheet p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-lg">TobySwap</span>
              <button className="pill pill-opaque" onClick={() => setOpen(false)} type="button">
                Close
              </button>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => go("/")}
                className="block w-full pill pill-opaque text-center"
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => go("/about")}
                className="block w-full pill pill-opaque text-center"
              >
                About
              </button>
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
