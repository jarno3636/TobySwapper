"use client";

import Image from "next/image";

export default function Background() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 world-paper" />
      <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#dff5ff] blur-3xl opacity-70" />
      <div className="absolute -right-24 top-[34%] h-80 w-80 rounded-full bg-[#fff0e6] blur-3xl opacity-75" />
      <div className="absolute bottom-[-40px] left-[4%] h-72 w-72 rounded-full bg-[#e8f8e9] blur-3xl opacity-60" />
      <div className="absolute bottom-10 left-[5%] opacity-[0.045] rotate-[-10deg]">
        <Image src="/tokens/taboshi.PNG" alt="" width={210} height={210} />
      </div>
      <div className="absolute right-[3%] top-[13%] opacity-[0.04] rotate-[8deg]">
        <Image src="/tokens/patience.PNG" alt="" width={210} height={210} />
      </div>
      <div className="absolute right-[9%] bottom-[6%] opacity-[0.035]">
        <Image src="/tokens/sato.PNG" alt="" width={170} height={170} className="rounded-full" />
      </div>
    </div>
  );
}
