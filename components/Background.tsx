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
        o: 0.35 + Math.random() * 0.4, // opacity range
        delay: i * 2,
        dur: 16 + i * 2,
      };
    });
  }, []);

  return (
    // z-0 so it sits under content, pointer-events-none so it never blocks clicks
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
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
          } as React.CSSProperties}
        >
          {/* just the image, no glass wrapper */}
          <div
            className="relative"
            style={{
              width: t.w,
              height: t.w,
              opacity: t.o,
              filter: "drop-shadow(0 10px 24px rgba(0,0,0,.35))", // optional depth
            }}
          >
            <Image
              src={t.src}
              alt=""
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
