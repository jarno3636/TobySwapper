// lib/miniapp.ts

/** Farcaster Mini App SDK shape (tolerant to older builds) */
type MiniAppSdk = {
  actions?: {
    openUrl?: (url: string | { url: string }) => Promise<void> | void; // modern
    openURL?: (url: string) => Promise<void> | void;                   // legacy
    composeCast?: (args: { text?: string; embeds?: string[] }) => Promise<void> | void;
    ready?: () => Promise<void> | void;
  };
  isInMiniApp?: () => boolean;
};

/* ---------------- Env helpers ---------------- */

export const SITE_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SITE_URL) ||
  "https://tobyswap.vercel.app";

export const MINIAPP_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_FC_MINIAPP_URL) ||
  "";

/* ---------------- UA heuristics ---------------- */

export function isFarcasterUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent);
}

/** Lenient Base/Coinbase UA heuristic (wallet, webview, or app) */
export function isBaseAppUA(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /BaseWallet|Base\sApp|Base\/\d|CoinbaseWallet|CoinbaseMobile|CoinbaseApp|CBBrowser|CBWallet|Coinbase(Android|iOS)?/i.test(
    ua
  );
}

/* ---------------- URL helpers ---------------- */

/** Make sure a URL is absolute and well-formed relative to a base. */
function toAbsoluteUrl(input: string, base = SITE_URL): string {
  try {
    return new URL(input, base).toString();
  } catch {
    try {
      return new URL(base).toString();
    } catch {
      return "https://tobyswap.vercel.app";
    }
  }
}

/** Pick the best embed target for Farcaster and make it absolute. */
export function farcasterEmbedUrl(): string {
  // Use Mini App URL only inside Warpcast (so it opens in-app). Else use site.
  const target = isFarcasterUA() && MINIAPP_URL ? MINIAPP_URL : SITE_URL;
  return toAbsoluteUrl(target, SITE_URL);
}

/** Prefer in-app Mini App URL in Warpcast, else normal site (absolute). */
export function fcPreferMini(pathOrAbs = ""): string {
  const base = isFarcasterUA() && MINIAPP_URL ? MINIAPP_URL : SITE_URL;
  const absBase = toAbsoluteUrl(base);
  if (!pathOrAbs) return absBase;
  if (/^https?:\/\//i.test(pathOrAbs)) return pathOrAbs;
  const sep = pathOrAbs.startsWith("/") ? "" : "/";
  return `${absBase}${sep}${pathOrAbs}`;
}

/* ---------------- Farcaster composer helpers ---------------- */

export function buildFarcasterComposeUrl({
  text = "",
  embeds = [] as string[],
}: {
  text?: string;
  embeds?: string[];
} = {}): string {
  const url = new URL("https://warpcast.com/~/compose");
  if (text) url.searchParams.set("text", text);

  // Always send absolute embed URLs
  for (const e of embeds || []) {
    const abs = e ? toAbsoluteUrl(e, SITE_URL) : "";
    if (abs) url.searchParams.append("embeds[]", abs);
  }
  return url.toString();
}

/* ---------------- Farcaster Mini App SDK loader ---------------- */

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

/** Best-effort: call sdk.actions.ready() quickly so we never hang. */
export async function ensureReady(timeoutMs = 1200): Promise<void> {
  try {
    const sdk = await getMiniSdk();
    if (!sdk?.actions?.ready) return;
    await Promise.race<void>([
      Promise.resolve(sdk.actions.ready()),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {}
}

/* ===================== Base App (MiniKit) ===================== */
/* We avoid bundling any MiniKit packages (caused build errors). Rely on injection. */

function getMiniKit(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w?.miniKit || w?.coinbase?.miniKit || null;
}

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

/* ---------------- Unified open helpers ---------------- */

/**
 * Open a URL with in-app navigation when available.
 * Tries MiniKit (Base) → Farcaster SDK → web fallbacks.
 */
export async function openInMini(url: string): Promise<boolean> {
  if (!url) return false;
  const safe = toAbsoluteUrl(url, SITE_URL);

  // 1) Base App via MiniKit (keeps user in Base)
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
 * Always normalizes embed URLs to absolute.
 */
export async function composeCast({
  text = "",
  embeds = [] as string[],
} = {}): Promise<boolean> {
  const normalizedEmbeds = (embeds || []).map((e) => toAbsoluteUrl(e, SITE_URL));

  // 1) Base App (MiniKit)
  if (await tryBaseComposeCast({ text, embeds: normalizedEmbeds })) return true;

  // 2) Farcaster Mini App SDK (Warpcast)
  const sdk = await getMiniSdk();
  if (sdk?.actions?.composeCast && isFarcasterUA()) {
    try {
      await ensureReady();
      await sdk.actions.composeCast({ text, embeds: normalizedEmbeds });
      return true;
    } catch {}
  }

  // 3) Not handled — caller should open the web composer themselves.
  return false;
}
