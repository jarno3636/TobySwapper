'use client';

import { ReactNode, MouseEvent } from 'react';
import { openInMini } from '@/lib/miniapp';

type Props = {
  href: string;
  children: ReactNode;
  className?: string;
  title?: string;
};

export default function LinkMaybeMini({ href, children, className, title }: Props) {
  const onClick = async (e: MouseEvent<HTMLAnchorElement>) => {
    // Let cmd/ctrl click open a new tab normally
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const ok = await openInMini(href);
    if (!ok) window.location.href = href;
  };

  return (
    <a href={href} onClick={onClick} className={className} title={title}>
      {children}
    </a>
  );
}
