// lib/miniapp.ts

/** Farcaster Mini App SDK shape (tolerant to older builds) */
type MiniAppSdk = {
  actions?: {
    openUrl?: (url: string | { url: string }) => Promise<void> | void; // new
    openURL?: (url: string) => Promise<void> | void;                   // legacy
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

/** ---- UA heuristics ---- */
export function isFarcasterUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent);
}

/** Very lenient Base app / Coinbase UA heuristic */
export function isBaseAppUA(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /BaseWallet|Base\sApp|Base\/\d|CoinbaseWallet|CoinbaseMobile|CoinbaseApp|CBBrowser|CBWallet|Coinbase(Android|iOS)?/i.test(
    ua
  );
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

/** ---- Farcaster SDK: module first, then globals fallback ---- */
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
  return !!(sdk?.isInMiniApp?.() ?? false);
}

/** Best-effort: call sdk.actions.ready() with a short timeout so we never hang. */
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

/* ===================== Base App (MiniKit) ===================== */

/** Get the injected MiniKit API if we are inside Base app */
function getMiniKit(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w?.miniKit || w?.coinbase?.miniKit || null;
}

/** Try MiniKit.composeCast inside Base App first */
async function tryBaseComposeCast(args: { text?: string; embeds?: string[] }) {
  if (!isBaseAppUA()) return false;
  try {
    const mk = getMiniKit();
    if (mk && typeof mk.composeCast === "function") {
      await mk.composeCast(args);
      return true;
    }
  } catch {}
  return false;
}

/** Public helper: open a URL via MiniKit inside Base; return true if handled */
export async function openInBase(url: string): Promise<boolean> {
  if (!isBaseAppUA()) return false;
  try {
    const mk = getMiniKit();
    if (mk && typeof mk.openUrl === "function") {
      await mk.openUrl(url);
      return true;
    }
    if (mk && typeof mk.openURL === "function") {
      await mk.openURL(url);
      return true;
    }
  } catch {}
  return false;
}

/**
 * Open a URL with in-app navigation when available.
 * Tries MiniKit (Base) → Farcaster SDK → web fallbacks.
 */
export async function openInMini(url: string): Promise<boolean> {
  if (!url) return false;

  const safe = new URL(
    String(url),
    (typeof window !== "undefined" && window.location?.origin) || SITE_URL
  ).toString();

  // 1) Base App via MiniKit
  if (await openInBase(safe)) return true;

  // 2) Farcaster SDK (Warpcast Mini App)
  const sdk = await getMiniSdk();
  if (sdk?.actions?.openUrl) {
    try {
      await sdk.actions.openUrl(safe);
      return true;
    } catch {
      try {
        await (sdk.actions.openUrl as any)({ url: safe });
        return true;
      } catch {}
    }
  }
  if (sdk?.actions?.openURL) {
    try {
      await sdk.actions.openURL(safe);
      return true;
    } catch {}
  }

  // 3) Web fallback
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
 * Prefer MiniKit inside Base; else Farcaster SDK inside Warpcast; else let caller open the web composer.
 */
export async function composeCast({
  text = "",
  embeds = [] as string[],
} = {}): Promise<boolean> {
  // 1) Base App (MiniKit)
  if (await tryBaseComposeCast({ text, embeds })) return true;

  // 2) Farcaster Mini App SDK (Warpcast)
  const sdk = await getMiniSdk();
  if (sdk?.actions?.composeCast && isFarcasterUA()) {
    try {
      await ensureReady();
      await sdk.actions.composeCast({ text, embeds });
      return true;
    } catch {}
  }

  // 3) Not handled — caller should open the web composer.
  return false;
}
