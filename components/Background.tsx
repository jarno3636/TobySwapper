"use client";
import Image from "next/image";
import { useMemo } from "react";

export default function Background() {
  // token + frog images (use your normalized names)
  const tokens = [
    "/tokens/toby.PNG",
    "/tokens/patience.PNG",
    "/tokens/taboshi.PNG",
    "/toby.PNG",
    "/satoby.PNG",
  ];

  // generate floaty tiles once on mount
  const floaties = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => {
      const src = tokens[i % tokens.length];
      const w = 60 + Math.floor(Math.random() * 100); // 60–160
      return {
        src,
        w,
        x: `${Math.random() * 100}%`,
        y: `${Math.random() * 100}%`,
        o: 0.3 + Math.random() * 0.5, // 0.3–0.8
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // don't re-run

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[var(--bg)]">
      {/* global blur veil */}
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
