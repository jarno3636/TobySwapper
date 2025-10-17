// lib/fc.ts
function abs(url: string, base: string) {
  try { return new URL(url, base).toString(); } catch { return base; }
}

export function getSiteUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return env && /^https?:\/\//i.test(env) ? env : "https://tobyswap.vercel.app";
}

/** Farcaster Mini App universal link (env first, hard fallback) */
export function getMiniUrl() {
  const env = process.env.NEXT_PUBLIC_FC_MINIAPP_URL?.trim();
  const fallback = "https://farcaster.xyz/miniapps/OBTWcExyxJMj/toby-swapper";
  const base = env && /^https?:\/\//i.test(env) ? env : fallback;
  // Normalize in case callers pass relative paths later
  return abs(base, getSiteUrl());
}
