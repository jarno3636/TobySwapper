"use client";

import Image from "next/image";

export default function Background() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 world-paper" />
      <div className="absolute -left-16 top-24 h-52 w-52 rounded-full bg-[#e8f7ff] blur-3xl opacity-80" />
      <div className="absolute -right-20 top-[38%] h-64 w-64 rounded-full bg-[#fff0df] blur-3xl opacity-90" />
      <div className="absolute bottom-8 left-[8%] opacity-[0.07] rotate-[-10deg]">
        <Image src="/tokens/taboshi.PNG" alt="" width={180} height={180} />
      </div>
      <div className="absolute right-[5%] top-[16%] opacity-[0.06] rotate-[8deg]">
        <Image src="/tokens/patience.PNG" alt="" width={180} height={180} />
      </div>
    </div>
  );
}
