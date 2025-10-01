<div
  key={i}
  className={`absolute floaty`}
  style={{
    left: t.x,
    top: t.y,
    transform: `rotate(${t.r}deg)`,
    animationDelay: `${i * 3}s`,      // stagger start
    animationDuration: `${16 + i*2}s` // vary speed
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
