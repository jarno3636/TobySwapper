"use client";
import Image from "next/image";
import { useMemo } from "react";

export default function Background() {
  const tokens = [
    "/tokens/toby.PNG",
    "/tokens/patience.PNG",
    "/tokens/taboshi.PNG",
    "/satoswap.PNG",
  ];

  const floaties = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => {
      const w = 60 + Math.floor(Math.random() * 100);
      return {
        src: tokens[i % tokens.length],
        w,
        x: `${Math.random() * 100}%`,
        y: `${Math.random() * 100}%`,
        o: 0.35 + Math.random() * 0.4, // a bit stronger so they show through
        delay: i * 2,
        dur: 16 + i * 2,
      };
    });
  }, []);

  return (
    // NOTE: z-0 (not negative) + pointer-events-none so it never blocks clicks
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* keep the dark bg so it reads as “black” */}
      <div className="absolute inset-0 bg-[var(--bg)]" />

      {floaties.map((t, i) => (
        <div
          key={i}
          className="absolute floaty"
          style={{
            left: t.x,
            top: t.y,
            animationDelay: `${t.delay}s`,
            animationDuration: `${t.dur}s`,
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
