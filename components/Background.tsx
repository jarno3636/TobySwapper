// components/Background.tsx
"use client";
import Image from "next/image";
import { useMemo } from "react";

export default function Background() {
  const tokens = [
    "/tokens/toby.PNG",
    "/tokens/patience.PNG",
    "/tokens/taboshi.PNG",
    "/tokens/usdc.PNG",
    "/tokens/weth.PNG",
    "/toby.PNG",
    "/toby-hero.PNG",
  ];

  const floaties = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => {
      const src = tokens[i % tokens.length];
      const w = 60 + Math.floor(Math.random() * 100);
      return {
        src,
        w,
        x: `${Math.random() * 100}%`,
        y: `${Math.random() * 100}%`,
        r: Math.floor(Math.random() * 360),
        o: 0.3 + Math.random() * 0.5,
      };
    });
  }, [tokens]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[var(--bg)] pointer-events-none">
      {/* optional: remove this if you don't need the global blur wash */}
      <div className="absolute inset-0 backdrop-blur-3xl" />

      {floaties.map((t, i) => (
        <div
          key={i}
          className="absolute floaty"
          style={{
            left: t.x,
            top: t.y,
            // pass base rotation via CSS var; your keyframes can use rotate(var(--r))
            // (works even if your current keyframes don't use it)
            ["--r" as any]: `${t.r}deg`,
            animationDelay: `${i * 3}s`,
            animationDuration: `${16 + i * 2}s`,
          }}
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
              zIndex: Math.round(t.o * 10),
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
