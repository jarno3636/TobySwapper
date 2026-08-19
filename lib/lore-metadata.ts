"use client";

import { resolveLoreUri } from "@/lib/lore-deeds";

export type LoreMetadata = {
  name?: string;
  description?: string;
  image?: string;
  animation_url?: string;
  external_url?: string;
  attributes?: Array<{ trait_type?: string; value?: unknown }>;
};

const CACHE_MS = 6 * 60 * 60_000;
const memory = new Map<string, { at: number; metadata: LoreMetadata | null }>();
const inflight = new Map<string, Promise<LoreMetadata | null>>();

function key(uri: string) {
  return `tobyswap:lore-metadata:v1:${uri}`;
}

function readStored(uri: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(uri));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; metadata?: LoreMetadata | null };
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > CACHE_MS) return null;
    return { at: parsed.at, metadata: parsed.metadata ?? null };
  } catch {
    return null;
  }
}

function writeStored(uri: string, metadata: LoreMetadata | null) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(uri), JSON.stringify({ at: Date.now(), metadata }));
  } catch {}
}

export function loreImage(metadata?: LoreMetadata | null) {
  return resolveLoreUri(metadata?.image);
}

export async function fetchLoreMetadata(rawUri?: string | null, force = false) {
  const uri = resolveLoreUri(rawUri);
  if (!uri) return null;

  if (!force) {
    const hot = memory.get(uri);
    if (hot && Date.now() - hot.at < CACHE_MS) return hot.metadata;

    const stored = readStored(uri);
    if (stored) {
      memory.set(uri, stored);
      return stored.metadata;
    }

    const existing = inflight.get(uri);
    if (existing) return existing;
  }

  const request = fetch(uri, {
    cache: "force-cache",
    headers: { accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Lore metadata ${response.status}`);
      const body = (await response.json()) as LoreMetadata;
      const metadata = body && typeof body === "object" ? body : null;
      memory.set(uri, { at: Date.now(), metadata });
      writeStored(uri, metadata);
      return metadata;
    })
    .catch(() => {
      memory.set(uri, { at: Date.now(), metadata: null });
      return null;
    })
    .finally(() => inflight.delete(uri));

  inflight.set(uri, request);
  return request;
}

export function clearLoreMetadataCache(rawUri?: string | null) {
  const uri = resolveLoreUri(rawUri);
  if (!uri) return;
  memory.delete(uri);
  inflight.delete(uri);
  if (typeof window !== "undefined") {
    try { localStorage.removeItem(key(uri)); } catch {}
  }
}
