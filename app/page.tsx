"use client"
import Image from "next/image"
import Link from "next/link"
import SwapWidget from "@/components/SwapWidget"

export default function Home() {
  return (
    <main className="min-h-screen bg-toby-gradient relative">
      <header className="mx-auto max-w-5xl flex justify-between px-4 py-6">
        <div className="flex items-center gap-3">
          <Image src="/toby-logo.svg" alt="TOBY" width={52} height={52} />
          <div className="text-3xl font-bold">Toby Swapper</div>
        </div>
        <nav className="flex gap-4">
          <Link href="https://toadgod.xyz" target="_blank">Site</Link>
          <Link href="https://x.com/toadgod1017" target="_blank">X</Link>
          <Link href="https://t.me/toadgang/212753" target="_blank">Telegram</Link>
        </nav>
      </header>
      <section className="mx-auto max-w-5xl px-4">
        <SwapWidget />
      </section>
    </main>
  )
}
