"use client";

import { loreUriCandidates, resolveLoreUri } from "@/lib/lore-deeds";

export type LoreMetadata = {
  name?: string;
  description?: string;
  image?: string;
  image_url?: string;
  imageUrl?: string;
  animation_url?: string;
  external_url?: string;
  attributes?: Array<{ trait_type?: string; value?: unknown }>;
};

export type LoreMetadataResult = {
  metadata: LoreMetadata | null;
  sourceUri: string | null;
  resolvedMetadataUri: string | null;
  directImage: string | null;
  error: string | null;
};

const REVEALED_CACHE_MS = 6 * 60 * 60_000;
const UNREVEALED_CACHE_MS = 5 * 60_000;

function cacheMsFor(result?: LoreMetadataResult | null) {
  const metadata = result?.metadata;
  const hasTraits = Array.isArray(metadata?.attributes) && metadata!.attributes!.some((trait) => trait?.value !== null && trait?.value !== undefined && String(trait.value).trim() !== "");
  // Placeholder metadata often includes an image too, so artwork alone cannot
  // safely tell us that the collection is revealed. Keep image-only metadata
  // on the short cache until real attributes arrive. The caller can force a
  // refresh as soon as the onchain `revealed` flag flips.
  return hasTraits ? REVEALED_CACHE_MS : UNREVEALED_CACHE_MS;
}
const memory = new Map<string, { at: number; result: LoreMetadataResult }>();
const inflight = new Map<string, Promise<LoreMetadataResult>>();

function storageKey(uri: string) {
  return `tobyswap:lore-metadata:v2:${uri}`;
}

function emptyResult(rawUri?: string | null, error: string | null = null): LoreMetadataResult {
  return {
    metadata: null,
    sourceUri: rawUri || null,
    resolvedMetadataUri: null,
    directImage: null,
    error,
  };
}

function decodeJsonDataUri(uri: string): LoreMetadata | null {
  try {
    const comma = uri.indexOf(",");
    if (comma < 0) return null;
    const header = uri.slice(0, comma);
    const body = uri.slice(comma + 1);
    const decoded = /;base64/i.test(header)
      ? atob(body)
      : decodeURIComponent(body);
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" ? parsed as LoreMetadata : null;
  } catch {
    return null;
  }
}

function isImageLike(uri: string, contentType?: string | null) {
  if (contentType?.toLowerCase().startsWith("image/")) return true;
  if (uri.startsWith("data:image/")) return true;
  return /\.(png|jpe?g|gif|webp|svg)(?:$|[?#])/i.test(uri);
}

function readStored(uri: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(uri));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; result?: LoreMetadataResult };
    if (typeof parsed.at !== "number" || !parsed.result || Date.now() - parsed.at > cacheMsFor(parsed.result)) {
      return null;
    }
    return { at: parsed.at, result: parsed.result };
  } catch {
    return null;
  }
}

function writeStored(uri: string, result: LoreMetadataResult) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(uri), JSON.stringify({ at: Date.now(), result }));
  } catch {}
}

export function loreImage(metadata?: LoreMetadata | null) {
  return resolveLoreUri(
    metadata?.image ||
    metadata?.image_url ||
    metadata?.imageUrl ||
    null,
  );
}

export function hasLoreTraits(metadata?: LoreMetadata | null) {
  return Array.isArray(metadata?.attributes) && metadata!.attributes!.some((trait) => {
    const value = trait?.value;
    return value !== null && value !== undefined && String(value).trim() !== "";
  });
}

export function looksLikePreRevealMetadata(metadata?: LoreMetadata | null) {
  if (!metadata) return true;
  const text = `${metadata.name || ""} ${metadata.description || ""}`.toLowerCase();
  return (
    !hasLoreTraits(metadata) ||
    /sealed|behind the veil|waits behind|unrevealed|not revealed|landscape still waits/.test(text)
  );
}

export function loreImageCandidates(metadata?: LoreMetadata | null, directImage?: string | null) {
  const raw =
    directImage ||
    metadata?.image ||
    metadata?.image_url ||
    metadata?.imageUrl ||
    null;
  return loreUriCandidates(raw);
}

export async function fetchLoreMetadataResult(
  rawUri?: string | null,
  force = false,
): Promise<LoreMetadataResult> {
  const original = rawUri?.trim() || "";
  if (!original) return emptyResult(rawUri, "No token URI returned.");

  if (!force) {
    const hot = memory.get(original);
    if (hot && Date.now() - hot.at < cacheMsFor(hot.result)) return hot.result;

    const stored = readStored(original);
    if (stored) {
      memory.set(original, stored);
      return stored.result;
    }

    const existing = inflight.get(original);
    if (existing) return existing;
  }

  // Even forced reveal refreshes share an in-flight request for the same URI.
  // This keeps the deed page + artwork component from hitting a gateway twice.
  const active = inflight.get(original);
  if (active) return active;

  const request = (async () => {
    // Inline JSON metadata is common for unrevealed NFTs.
    if (original.startsWith("data:application/json")) {
      const metadata = decodeJsonDataUri(original);
      const result: LoreMetadataResult = metadata
        ? {
            metadata,
            sourceUri: original,
            resolvedMetadataUri: original,
            directImage: null,
            error: null,
          }
        : emptyResult(original, "Inline NFT metadata could not be decoded.");
      memory.set(original, { at: Date.now(), result });
      writeStored(original, result);
      return result;
    }

    // A tokenURI may legally point straight at an image.
    if (isImageLike(original)) {
      const directImage = resolveLoreUri(original);
      const result: LoreMetadataResult = {
        metadata: null,
        sourceUri: original,
        resolvedMetadataUri: null,
        directImage,
        error: null,
      };
      memory.set(original, { at: Date.now(), result });
      writeStored(original, result);
      return result;
    }

    const candidates = loreUriCandidates(original);
    let lastError = "Canonical metadata could not be loaded.";

    for (const uri of candidates) {
      try {
        const response = await fetch(uri, {
          cache: force ? "no-store" : "force-cache",
          headers: { accept: "application/json,image/*;q=0.9,*/*;q=0.5" },
        });

        if (!response.ok) {
          lastError = `Metadata gateway returned ${response.status}.`;
          continue;
        }

        const contentType = response.headers.get("content-type");

        if (isImageLike(uri, contentType)) {
          const result: LoreMetadataResult = {
            metadata: null,
            sourceUri: original,
            resolvedMetadataUri: uri,
            directImage: uri,
            error: null,
          };
          memory.set(original, { at: Date.now(), result });
          writeStored(original, result);
          return result;
        }

        const text = await response.text();
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === "object") {
            const result: LoreMetadataResult = {
              metadata: parsed as LoreMetadata,
              sourceUri: original,
              resolvedMetadataUri: uri,
              directImage: null,
              error: null,
            };
            memory.set(original, { at: Date.now(), result });
            writeStored(original, result);
            return result;
          }
        } catch {
          lastError = "The token URI did not return valid NFT metadata.";
        }
      } catch {
        lastError = "The current metadata gateway could not be reached.";
      }
    }

    const result = emptyResult(original, lastError);
    memory.set(original, { at: Date.now(), result });
    writeStored(original, result);
    return result;
  })().finally(() => inflight.delete(original));

  inflight.set(original, request);
  return request;
}

export async function fetchLoreMetadata(rawUri?: string | null, force = false) {
  return (await fetchLoreMetadataResult(rawUri, force)).metadata;
}

export function clearLoreMetadataCache(rawUri?: string | null) {
  const uri = rawUri?.trim();
  if (!uri) return;
  memory.delete(uri);
  inflight.delete(uri);
  if (typeof window !== "undefined") {
    try { localStorage.removeItem(storageKey(uri)); } catch {}
  }
}
