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

/* ---------------- Env helpers ---------------- */

export const SITE_URL =
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_SITE_URL) ||
  "https://tobyswap.vercel.app";

export const MINIAPP_URL =
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_FC_MINIAPP_URL) ||
  "";

/* ---------------- UA heuristics ---------------- */

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

/* ---------------- URL helpers ---------------- */

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

/** Always prefer the Mini App URL for embeds (keeps users inside Farcaster). */
function preferMiniBase(): string {
  return MINIAPP_URL && MINIAPP_URL.length > 0 ? MINIAPP_URL : SITE_URL;
}

/** Prefer Mini App URL inside Warpcast; else normal site (absolute). */
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

  // Normalize embed URLs to the Mini App base so casts open in-app
  const miniBase = preferMiniBase();
  for (const e of embeds || []) {
    const abs = e ? toAbsoluteUrl(e, miniBase) : "";
    if (abs) url.searchParams.append("embeds[]", abs);
  }
  return url.toString();
}

/* ---------------- SDK loaders ---------------- */

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

/** Async signal from SDK; more reliable than UA sniffing. */
export async function isInFarcasterMini(): Promise<boolean> {
  try {
    const sdk = await getMiniSdk();
    if (typeof sdk?.isInMiniApp === "function") return !!sdk.isInMiniApp();
  } catch {}
  return isFarcasterUA(); // fallback if SDK unavailable
}

/** Call sdk.actions.ready() quickly so we never hang splash */
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

/* ===================== Base App (MiniKit globals) ===================== */

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

/** Try to open a URL natively (Base MiniKit ➜ Farcaster SDK), else let caller fall back to web */
export async function openInMini(url: string): Promise<boolean> {
  if (!url) return false;
  // Prefer the mini base so in-app opens land on the Mini App
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

  // 2) Farcaster Mini App SDK (Warpcast)
  try {
    const sdk = await getMiniSdk();
    if (sdk?.actions?.openUrl) {
      try {
        await sdk.actions.openUrl(safe);
        return true;
      } catch {
        // Some builds expect an object
        await (sdk.actions.openUrl as any)({ url: safe });
        return true;
      }
    }
    if (sdk?.actions?.openURL) {
      await sdk.actions.openURL(safe);
      return true;
    }
  } catch {}

  // 3) Not handled
  return false;
}

/**
 * Unified compose helper:
 * 1) Base App (MiniKit.composeCast)
 * 2) Warpcast Mini App SDK (sdk.actions.composeCast)
 * 3) Fail -> caller should open web /~/compose
 *
 * Embeds are normalized to the Mini App base to ensure taps open inside Farcaster.
 */
export async function composeCast({
  text = "",
  embeds = [] as string[],
} = {}): Promise<boolean> {
  const base = preferMiniBase();
  const normalizedEmbeds = (embeds || []).map((e) => toAbsoluteUrl(e, base));

  if (await tryBaseComposeCast({ text, embeds: normalizedEmbeds })) return true;

  const sdk = await getMiniSdk();
  const inMini = await isInFarcasterMini();
  if (sdk?.actions?.composeCast && inMini) {
    try {
      await ensureReady();
      await sdk.actions.composeCast({ text, embeds: normalizedEmbeds });
      return true;
    } catch {}
  }

  return false;
}
