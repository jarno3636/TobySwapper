// lib/miniapp.ts

type MiniAppSdk = {
  actions?: {
    // Newer SDKs: lower-case "l", may accept string or object
    openUrl?: (url: string | { url: string }) => Promise<void> | void;
    // Older SDKs: legacy name
    openURL?: (url: string) => Promise<void> | void;

    composeCast?: (args: { text?: string; embeds?: string[] }) => Promise<void> | void;
    ready?: () => Promise<void> | void;
  };
  isInMiniApp?: () => boolean;
};

// Try module import first; fall back to common globals some hosts expose.
export async function getMiniSdk(): Promise<MiniAppSdk | null> {
  if (typeof window === 'undefined') return null;
  try {
    const mod = (await import('@farcaster/miniapp-sdk')) as {
      sdk?: MiniAppSdk;
      default?: MiniAppSdk;
    };
    const fromModule = mod?.sdk ?? mod?.default;
    if (fromModule) return fromModule;

    // Best-effort globals fallback (don’t throw if absent)
    const g = window as any;
    return (
      g?.farcaster?.miniapp?.sdk || // some clients
      g?.sdk ||                      // very old examples
      null
    );
  } catch {
    const g = window as any;
    return g?.farcaster?.miniapp?.sdk || g?.sdk || null;
  }
}

export async function isMiniApp(): Promise<boolean> {
  const sdk = await getMiniSdk();
  // Prefer SDK signal when available; otherwise false
  return !!(sdk?.isInMiniApp?.() ?? false);
}

/**
 * Best-effort: call sdk.actions.ready() with a short timeout so we never hang.
 * Safe to call multiple times; no-ops outside Mini App.
 */
export async function ensureReady(timeoutMs = 1200): Promise<void> {
  try {
    const sdk = await getMiniSdk();
    if (!sdk?.actions?.ready) return;

    await Promise.race<void>([
      Promise.resolve(sdk.actions.ready()),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {
    // ignore
  }
}

/**
 * Open a URL with Mini App navigation when available.
 * Supports:
 *   - sdk.actions.openUrl(safe)
 *   - sdk.actions.openUrl({ url: safe })
 *   - sdk.actions.openURL(safe) (legacy)
 * Falls back to same-tab on web.
 */
export async function openInMini(url: string): Promise<boolean> {
  if (!url) return false;

  const safe = new URL(
    String(url),
    (typeof window !== 'undefined' && window.location?.origin) || 'https://tobyswap.vercel.app'
  ).toString();

  const sdk = await getMiniSdk();

  // Prefer modern openUrl (string)
  if (sdk?.actions?.openUrl) {
    try {
      await sdk.actions.openUrl(safe);
      return true;
    } catch {
      // try object shape next
      try {
        await sdk.actions.openUrl({ url: safe });
        return true;
      } catch {
        // fall through
      }
    }
  }

  // Legacy openURL
  if (sdk?.actions?.openURL) {
    try {
      await sdk.actions.openURL(safe);
      return true;
    } catch {
      // fall through to web
    }
  }

  // Web fallbacks
  if (typeof window !== 'undefined') {
    try {
      window.location.assign(safe);
      return true;
    } catch {}
    try {
      window.open(safe, '_self', 'noopener,noreferrer');
      return true;
    } catch {}
  }

  return false;
}

/**
 * Prefer SDK composer; fall back to Warpcast web composer.
 * Return value signals whether the SDK path succeeded.
 */
export async function composeCast({
  text = '',
  embeds = [] as string[],
} = {}): Promise<boolean> {
  const sdk = await getMiniSdk();
  if (sdk?.actions?.composeCast) {
    try {
      await sdk.actions.composeCast({ text, embeds });
      return true;
    } catch {
      // fall through
    }
  }
  return false;
}
