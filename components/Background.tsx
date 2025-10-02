"use client";
import Image from "next/image";
import { useMemo } from "react";

export default function Background() {
  const tokens = [
    "/tokens/toby.PNG",
    "/tokens/patience.PNG",
    "/tokens/taboshi.PNG",
    "/toby.PNG",
  ];

  const floaties = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => {
      const w = 60 + Math.floor(Math.random() * 100);
      return {
        src: tokens[i % tokens.length],
        w,
        x: `${Math.random() * 100}%`,
        y: `${Math.random() * 100}%`,
        r: Math.floor(Math.random() * 360),
        o: 0.30 + Math.random() * 0.5,
      };
    });
  }, []); // ← no deps

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[var(--bg)]">
      <div className="absolute inset-0 backdrop-blur-3xl" />
      {floaties.map((t, i) => (
        <div
          key={i}
          className="absolute floaty"
          style={{
            left: t.x,
            top: t.y,
            animationDelay: `${i * 3}s`,
            animationDuration: `${16 + i * 2}s`,
          } as React.CSSProperties}
        >
          <div
            className="rounded-3xl backdrop-blur-sm"
            style={{
              width: t.w,
              height: t.w,
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.08)",
              boxShadow: "0 16px 40px rgba(0,0,0,.35)",
              overflow: "hidden",
              opacity: t.o,
            }}
          >
            <div className="relative w-full h-full">
              <Image
                src={t.src}
                alt=""
                fill
                sizes={`${t.w}px`}
                className="object-cover"
                priority={i < 2}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
