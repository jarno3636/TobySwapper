// lib/miniapp.ts

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

/** Prefer Mini App URL inside Warpcast if env var is set; else normal site (absolute). */
export function fcPreferMini(pathOrAbs = ""): string {
  const base = MINIAPP_URL || SITE_URL; // don’t rely on UA here
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
  for (const e of embeds || []) {
    const abs = e ? toAbsoluteUrl(e, SITE_URL) : "";
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
  } catch {}
  const g = window as any;
  return g?.farcaster?.miniapp?.sdk || g?.sdk || null;
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
  try {
    const mk = getMiniKit();
    if (mk?.composeCast) {
      await mk.composeCast(args);
      return true;
    }
  } catch {}
  return false;
}

/** Public helper: open a URL via MiniKit or Farcaster SDK; return true if handled */
export async function openInMini(url: string): Promise<boolean> {
  if (!url) return false;
  const safe = toAbsoluteUrl(url, SITE_URL);

  // 1) Base App MiniKit (if injected)
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

  // 2) Farcaster Mini App SDK (if injected)
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

  return false;
}

/**
 * Unified compose helper:
 * 1) Base App (MiniKit.composeCast) if present
 * 2) Farcaster Mini App SDK (sdk.actions.composeCast) if present
 * 3) Fail -> caller should open web /~/compose
 */
export async function composeCast({
  text = "",
  embeds = [] as string[],
} = {}): Promise<boolean> {
  const normalizedEmbeds = (embeds || []).map((e) => toAbsoluteUrl(e, SITE_URL));

  if (await tryBaseComposeCast({ text, embeds: normalizedEmbeds })) return true;

  const sdk = await getMiniSdk();
  if (sdk?.actions?.composeCast) {
    try {
      await ensureReady();
      await sdk.actions.composeCast({ text, embeds: normalizedEmbeds });
      return true;
    } catch {}
  }

  return false;
}
