"use client";

import Link from "next/link";
import Image from "next/image";
import ConnectPill from "@/components/ConnectPill";
import ThemeToggle from "@/components/ThemeToggle";

const quickLinks = [
  { href: "/#swap", label: "Pond" },
  { href: "/taboshi1", label: "Pouch" },
  { href: "/world", label: "World" },
  { href: "/world/exchange", label: "Market" },
] as const;

export default function Brand() {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/" prefetch={false} className="brand-lockup group">
          <span className="brand-medallion relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl">
            <Image src="/tokens/toby.PNG" alt="Toby" fill sizes="44px" className="object-contain p-[2px]" priority />
          </span>
          <span className="brand-copy">
            <span className="brand-eyebrow">TOBYWORLD</span>
            <span className="brand-title">TobySwapper</span>
          </span>
        </Link>

        <nav className="header-quick-nav" aria-label="Primary">
          {quickLinks.map((item) => (
            <Link prefetch={false} key={item.href} href={item.href} className="header-quick-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          <ConnectPill />
        </div>
      </div>
    </header>
  );
}
