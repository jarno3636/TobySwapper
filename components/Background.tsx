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
        o: 0.35 + Math.random() * 0.4,
        delay: i * 2,
        dur: 16 + i * 2,
      };
    });
  }, []);

  return (
    // pointer-events-none: never blocks clicks; z-0 keeps it under your z-10 content wrapper
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* dark base background */}
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
            // smoother animation on mobile GPUs
            willChange: "transform",
            transform: "translateZ(0)",
          } as React.CSSProperties}
        >
          <div
            className="relative"
            style={{
              width: t.w, // px implied
              height: t.w,
              opacity: t.o,
              filter: "drop-shadow(0 10px 24px rgba(0,0,0,.35))",
            }}
          >
            <Image
              src={t.src}
              alt=""              // decorative
              fill
              sizes={`${t.w}px`}
              className="object-contain select-none"
              priority={i < 2}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
