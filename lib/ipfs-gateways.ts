/**
 * Shared IPFS gateway policy for TobySwap.
 *
 * Keep large Lore artwork browser -> gateway. Vercel should resolve metadata
 * and provide a last-resort redirect, not proxy multi-megabyte image bodies.
 */
export const IPFS_GATEWAYS = [
  "https://w3s.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://inbrowser.link/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
] as const;

export function ipfsPath(value?: string | null) {
  const uri = value?.trim() || "";
  if (!uri) return null;

  if (uri.startsWith("ipfs://ipfs/")) return uri.slice("ipfs://ipfs/".length);
  if (uri.startsWith("ipfs://")) return uri.slice("ipfs://".length);

  // Normalize an existing public gateway URL back to the canonical /ipfs/ path
  // so callers can still rotate gateways after a stale/slow HTTP gateway fails.
  try {
    const parsed = new URL(uri);
    const marker = "/ipfs/";
    const index = parsed.pathname.indexOf(marker);
    if (index >= 0) {
      const path = parsed.pathname.slice(index + marker.length);
      return path ? `${path}${parsed.search || ""}` : null;
    }
  } catch {}

  return null;
}

export function ipfsCandidates(value?: string | null) {
  const uri = value?.trim() || "";
  if (!uri) return [] as string[];
  if (uri.startsWith("data:")) return [uri];
  if (uri.startsWith("ar://")) return [`https://arweave.net/${uri.slice(5)}`];

  const path = ipfsPath(uri);
  if (!path) return [uri];

  const urls = IPFS_GATEWAYS.map((gateway) => `${gateway}${path}`);
  // Preserve a non-IPFS HTTP source as the first choice. Existing gateway URLs
  // are deliberately normalized/rotated instead of being pinned to one host.
  if (/^https?:\/\//i.test(uri) && !uri.includes("/ipfs/")) urls.unshift(uri);
  return [...new Set(urls)];
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 4_500,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
