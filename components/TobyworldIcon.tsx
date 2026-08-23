import Image from "next/image";

type TobyworldIconKind = "lore" | "pouch" | "toby" | "sato" | "patience" | "taboshi" | "seed";

const sources: Record<Exclude<TobyworldIconKind, "pouch">, string> = {
  lore: "/ui/new-lore.webp",
  toby: "/tokens/toby.PNG",
  sato: "/ui/sato.webp",
  patience: "/ui/patience.webp",
  taboshi: "/ui/taboshi.webp",
  seed: "/ui/seed.webp",
};

export default function TobyworldIcon({
  kind,
  size = 40,
  className = "",
}: {
  kind: TobyworldIconKind;
  size?: number;
  className?: string;
}) {
  if (kind === "pouch") {
    return (
      <span
        className={`tw-system-icon tw-system-icon-pouch ${className}`.trim()}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 64 64" role="img">
          <path d="M21 18c1.4-5.8 5.4-9 11-9s9.6 3.2 11 9" />
          <path d="M18 21h28l7 27c1 4-2 7-6 7H17c-4 0-7-3-6-7l7-27Z" />
          <path d="M22 23c2.8 4.2 6.1 6.3 10 6.3S39.2 27.2 42 23" />
          <path d="m32 34 4.6 8h-9.2L32 34Z" />
        </svg>
      </span>
    );
  }

  return (
    <span
      className={`tw-system-icon tw-system-icon-${kind} ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image src={sources[kind]} alt="" fill sizes={`${size}px`} className="object-contain" />
    </span>
  );
}
