// lib/miniapp.ts
type MiniAppSdk = {
  actions?: {
    openURL?: (url: string) => Promise<void> | void;
    composeCast?: (args: { text?: string; embeds?: string[] }) => Promise<void> | void;
  };
  isInMiniApp?: () => boolean;
};

export async function getMiniSdk(): Promise<MiniAppSdk | null> {
  if (typeof window === 'undefined') return null;
  try {
    const mod = (await import('@farcaster/miniapp-sdk')) as { sdk?: MiniAppSdk; default?: MiniAppSdk };
    return mod.sdk ?? mod.default ?? null;
  } catch {
    return null;
  }
}

export async function isMiniApp(): Promise<boolean> {
  const sdk = await getMiniSdk();
  return !!(sdk?.isInMiniApp?.() ?? false);
}

export async function openInMini(url: string): Promise<boolean> {
  if (!url) return false;
  const safe = new URL(
    String(url),
    (typeof window !== 'undefined' && window.location?.origin) || 'https://tobyswap.vercel.app'
  ).toString();

  const sdk = await getMiniSdk();
  if (sdk?.actions?.openURL) {
    try {
      await sdk.actions.openURL(safe);
      return true;
    } catch {}
  }

  if (typeof window !== 'undefined') {
    try { window.location.assign(safe); return true; } catch {}
    try { window.open(safe, '_self', 'noopener,noreferrer'); return true; } catch {}
  }
  return false;
}

export async function composeCast({ text = '', embeds = [] as string[] } = {}): Promise<boolean> {
  const sdk = await getMiniSdk();
  if (sdk?.actions?.composeCast) {
    try {
      await sdk.actions.composeCast({ text, embeds });
      return true;
    } catch {}
  }
  return false;
}
