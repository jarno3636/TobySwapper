"use client";
import Image from "next/image";

// Absolute, blurred, low-opacity tiles behind everything
// Uses /public/tokens/*.PNG and /public/satoswap.PNG
export default function Background() {
  const tiles = [
    { src: "/tokens/toby.PNG",     w: 180, x: "5%",   y: "12%", r: -6,  o: .25 },
    { src: "/tokens/patience.PNG", w: 140, x: "18%",  y: "70%", r: 8,   o: .22 },
    { src: "/tokens/taboshi.PNG",  w: 160, x: "72%",  y: "20%", r: 12,  o: .22 },
    { src: "/tokens/usdc.PNG",     w: 120, x: "80%",  y: "65%", r: -10, o: .20 },
    { src: "/tokens/weth.PNG",     w: 140, x: "40%",  y: "15%", r: 4,   o: .20 },
    { src: "/satoswap.PNG",        w: 240, x: "48%",  y: "58%", r: -4,  o: .18 },
  ];

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      {/* soft gradient base */}
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_70%_20%,rgba(124,58,237,.12),transparent),radial-gradient(900px_400px_at_20%_80%,rgba(34,197,94,.10),transparent)]" />
      {tiles.map((t, i) => (
        <div
          key={i}
          className="absolute"
          style={{ left: t.x, top: t.y, transform: `rotate(${t.r}deg)` }}
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
