// lib/miniapp.ts

/** Farcaster Mini App SDK shape (tolerant to older builds) */
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

/** ---- Env helpers ---- */
export const SITE_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SITE_URL) ||
  "https://tobyswap.vercel.app";

export const MINIAPP_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_FC_MINIAPP_URL) ||
  "";

/** ---- UA heuristics (don’t depend on it for logic that must be bulletproof) ---- */
export function isFarcasterUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent);
}

/** Prefer in-app Mini App URL in Warpcast, else normal site */
export function fcPreferMini(pathOrAbs = ""): string {
  const base = isFarcasterUA() && MINIAPP_URL ? MINIAPP_URL : SITE_URL;
  if (!pathOrAbs) return base;
  if (/^https?:\/\//i.test(pathOrAbs)) return pathOrAbs;
  const sep = pathOrAbs.startsWith("/") ? "" : "/";
  return `${base}${sep}${pathOrAbs}`;
}

/** Build a Warpcast composer URL (works on web/dapps) */
export function buildFarcasterComposeUrl({
  text = "",
  embeds = [] as string[],
}: {
  text?: string;
  embeds?: string[];
} = {}): string {
  const url = new URL("https://warpcast.com/~/compose");
  if (text) url.searchParams.set("text", text);
  for (const e of embeds || []) {
    if (e) url.searchParams.append("embeds[]", e);
  }
  return url.toString();
}

/** ---- SDK loader: module first, then globals fallback ---- */
export async function getMiniSdk(): Promise<MiniAppSdk | null> {
  if (typeof window === "undefined") return null;
  try {
    const mod = (await import("@farcaster/miniapp-sdk")) as {
      sdk?: MiniAppSdk;
      default?: MiniAppSdk;
    };
    const fromModule = mod?.sdk ?? mod?.default;
    if (fromModule) return fromModule;

    const g = window as any;
    return g?.farcaster?.miniapp?.sdk || g?.sdk || null;
  } catch {
    const g = window as any;
    return g?.farcaster?.miniapp?.sdk || g?.sdk || null;
  }
}

export async function isMiniApp(): Promise<boolean> {
  const sdk = await getMiniSdk();
  // Prefer explicit SDK signal when available
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
 * Tries:
 *   - sdk.actions.openUrl(safe)
 *   - sdk.actions.openUrl({ url: safe })
 *   - sdk.actions.openURL(safe) (legacy)
 * Falls back to same-tab on web.
 */
export async function openInMini(url: string): Promise<boolean> {
  if (!url) return false;

  const safe = new URL(
    String(url),
    (typeof window !== "undefined" && window.location?.origin) || SITE_URL
  ).toString();

  const sdk = await getMiniSdk();

  // Prefer modern openUrl(string)
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
      // fall through
    }
  }

  // Web fallbacks
  if (typeof window !== "undefined") {
    try {
      window.location.assign(safe);
      return true;
    } catch {}
    try {
      window.open(safe, "_self", "noopener,noreferrer");
      return true;
    } catch {}
  }

  return false;
}

/**
 * Prefer SDK composer **only inside Warpcast**; otherwise return false so callers
 * can open the web composer (anchor href) reliably.
 * Return value signals whether the SDK path succeeded.
 */
export async function composeCast({
  text = "",
  embeds = [] as string[],
} = {}): Promise<boolean> {
  const sdk = await getMiniSdk();

  // Only consider SDK path handled if we're truly in Warpcast and it succeeds
  if (sdk?.actions?.composeCast && isFarcasterUA()) {
    try {
      await sdk.actions.composeCast({ text, embeds });
      return true; // handled in-app
    } catch {
      // fall through
    }
  }
  return false; // let caller open Warpcast web composer
}
