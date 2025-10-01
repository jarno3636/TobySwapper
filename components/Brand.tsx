"use client";
import Link from "next/link";
import Image from "next/image";

export default function Brand() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-black/30">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold flex items-center gap-3">
          <span className="relative inline-flex items-center justify-center w-9 h-9 rounded-full glass overflow-hidden">
            <Image src="/toby.PNG" alt="Toby" fill sizes="36px" className="object-cover" />
          </span>
          <span>Toby Swapper</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/about" className="pill glass hover:opacity-90"><span className="pip pip-a" /> About</Link>
          <a href="https://toadgod.xyz" target="_blank" className="pill glass"><span className="pip pip-b" /> Site</a>
          <a href="https://x.com/toadgod1017" target="_blank" className="pill glass"><span className="pip pip-c" /> X</a>
          <a href="https://t.me/toadgang/212753" target="_blank" className="pill glass">TG</a>
        </nav>
      </div>
    </header>
  );
}
