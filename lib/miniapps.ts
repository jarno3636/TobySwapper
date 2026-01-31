// lib/miniapps.ts

/** Farcaster Mini App SDK shape (tolerant to older builds) */
type MiniAppSdk = {
  actions?: {
    openUrl?: (url: string | { url: string }) => Promise<void> | void;
    openURL?: (url: string) => Promise<void> | void; // legacy
    composeCast?: (args: { text?: string; embeds?: string[] }) => Promise<void> | void;
    ready?: () => Promise<void> | void;
  };
  isInMiniApp?: () => boolean;
};

/* =========================
 * Env helpers
 * ========================= */

export const SITE_URL =
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_SITE_URL) ||
  "https://tobyswap.vercel.app";

export const MINIAPP_URL =
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_FC_MINIAPP_URL) ||
  "";

/* =========================
 * UA heuristics (fallback only)
 * ========================= */

export function isFarcasterUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent);
}

export function isBaseAppUA(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /BaseWallet|Base\sApp|Base\/\d|CoinbaseWallet|CoinbaseMobile|CoinbaseApp|CBBrowser|CBWallet|Coinbase(Android|iOS)?/i.test(
    ua
  );
}

/* =========================
 * URL helpers
 * ========================= */

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

/** Prefer Mini App base when available */
function preferMiniBase(): string {
  return MINIAPP_URL && MINIAPP_URL.length > 0 ? MINIAPP_URL : SITE_URL;
}

/** Prefer Mini App URL inside Warpcast; else normal site */
export function fcPreferMini(pathOrAbs = ""): string {
  const base = isFarcasterUA() && MINIAPP_URL ? MINIAPP_URL : SITE_URL;
  const absBase = toAbsoluteUrl(base);
  if (!pathOrAbs) return absBase;
  if (/^https?:\/\//i.test(pathOrAbs)) return pathOrAbs;
  const sep = pathOrAbs.startsWith("/") ? "" : "/";
  return `${absBase}${sep}${pathOrAbs}`;
}

/* =========================
 * Farcaster web composer
 * ========================= */

export function buildFarcasterComposeUrl({
  text = "",
  embeds = [] as string[],
}: {
  text?: string;
  embeds?: string[];
} = {}): string {
  const url = new URL("https://warpcast.com/~/compose");
  if (text) url.searchParams.set("text", text);

  const miniBase = preferMiniBase();
  for (const e of embeds) {
    const abs = e ? toAbsoluteUrl(e, miniBase) : "";
    if (abs) url.searchParams.append("embeds[]", abs);
  }

  return url.toString();
}

/* =========================
 * SDK loaders
 * ========================= */

export async function getMiniSdk(): Promise<MiniAppSdk | null> {
  if (typeof window === "undefined") return null;

  try {
    const mod = (await import("@farcaster/miniapp-sdk")) as {
      sdk?: MiniAppSdk;
      default?: MiniAppSdk;
    };
    return mod?.sdk ?? mod?.default ?? null;
  } catch {
    const g = window as any;
    return g?.farcaster?.miniapp?.sdk || g?.sdk || null;
  }
}

/** Fire ready() quickly so Mini App splash never hangs */
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

/* =========================
 * Base App (MiniKit globals)
 * ========================= */

function getMiniKit(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w?.miniKit || w?.coinbase?.miniKit || null;
}

async function tryBaseComposeCast(args: { text?: string; embeds?: string[] }) {
  if (!isBaseAppUA()) return false;
  try {
    const mk = getMiniKit();
    if (mk?.composeCast) {
      await mk.composeCast(args);
      return true;
    }
  } catch {}
  return false;
}

/* =========================
 * Open URL natively when possible
 * ========================= */

export async function openInMini(url: string): Promise<boolean> {
  if (!url) return false;
  const safe = toAbsoluteUrl(url, preferMiniBase());

  // 1) Base App MiniKit
  try {
    const mk = getMiniKit();
    if (mk?.openUrl) {
      await mk.openUrl(safe);
      return true;
    }
    if (mk?.openURL) {
      await mk.openURL(safe);
      return true;
    }
  } catch {}

  // 2) Warpcast Mini App SDK
  try {
    const sdk = await getMiniSdk();
    if (sdk?.actions?.openUrl) {
      try {
        await sdk.actions.openUrl(safe);
        return true;
      } catch {
        await (sdk.actions.openUrl as any)({ url: safe });
        return true;
      }
    }
    if (sdk?.actions?.openURL) {
      await sdk.actions.openURL(safe);
      return true;
    }
  } catch {}

  return false;
}

/* =========================
 * Unified composeCast
 * ========================= */

/**
 * Order:
 * 1) Base App (MiniKit.composeCast)
 * 2) Warpcast Mini App SDK (sdk.actions.composeCast)
 * 3) Caller falls back to web /~/compose
 */
export async function composeCast({
  text = "",
  embeds = [] as string[],
} = {}): Promise<boolean> {
  const base = preferMiniBase();
  const normalizedEmbeds = embeds.map((e) => toAbsoluteUrl(e, base));

  // 1) Base App
  if (await tryBaseComposeCast({ text, embeds: normalizedEmbeds })) {
    return true;
  }

  // 2) Warpcast Mini App (do NOT gate on isInMini)
  const sdk = await getMiniSdk();
  if (sdk?.actions?.composeCast) {
    try {
      await ensureReady();
      await sdk.actions.composeCast({ text, embeds: normalizedEmbeds });
      return true;
    } catch {}
  }

  // 3) Not handled
  return false;
}
