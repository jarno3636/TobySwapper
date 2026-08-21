"use client";

import Image from "next/image";

export default function Background() {
  return (
    <div className="app-background fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 world-paper" />
      <div className="ambient-orb ambient-orb-blue" />
      <div className="ambient-orb ambient-orb-warm" />
      <div className="ambient-orb ambient-orb-green" />
      <div className="ambient-token ambient-token-taboshi">
        <Image src="/ui/taboshi.webp" alt="" width={210} height={210} />
      </div>
      <div className="ambient-token ambient-token-patience">
        <Image src="/ui/patience.webp" alt="" width={210} height={210} />
      </div>
      <div className="ambient-token ambient-token-sato">
        <Image src="/ui/sato.webp" alt="" width={170} height={170} className="rounded-full" />
      </div>
    </div>
  );
}
