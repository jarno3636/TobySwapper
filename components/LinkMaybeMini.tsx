"use client";

import type { ReactNode, MouseEvent } from "react";
import { isFarcasterUA, openInMini } from "@/lib/miniapp";

type Props = {
  href: string;
  children: ReactNode;
  className?: string;
  title?: string;
};

/**
 * Standard links stay standard on the web/Base App. In a Farcaster host we
 * ask the Mini App SDK to open the URL, with normal navigation as a fallback.
 */
export default function LinkMaybeMini({ href, children, className, title }: Props) {
  const onClick = async (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!isFarcasterUA()) return;

    e.preventDefault();
    const ok = await openInMini(href);
    if (!ok) window.location.href = href;
  };

  return (
    <a
      href={href}
      onClick={onClick}
      className={className}
      title={title}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}
