"use client";

import type { Address } from "viem";

export const POUCH_THEMES = [
  "pond",
  "moss",
  "moon",
  "lotus",
  "ember",
  "tide",
] as const;

export type PouchTheme = (typeof POUCH_THEMES)[number];

export type PublicPouchProfile = {
  slug: string;
  walletAddress: Address;
  pageName: string;
  description: string | null;
  theme: PouchTheme;
  featuredDeed: string | null;
  showWallet: boolean;
  verified: boolean;
  xUrl: string | null;
  farcasterUrl: string | null;
  websiteUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type LocalPouchEditor = {
  slug: string;
  secret: string;
};

const MEMORY_MS = 10 * 60_000;
const memory = new Map<string, { at: number; value: PublicPouchProfile | null }>();
const walletMemory = new Map<string, { at: number; value: PublicPouchProfile | null }>();

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

function normalizeTheme(value: unknown): PouchTheme {
  return POUCH_THEMES.includes(value as PouchTheme)
    ? (value as PouchTheme)
    : "pond";
}

function rowToProfile(row: any): PublicPouchProfile {
  return {
    slug: String(row.slug),
    walletAddress: row.wallet_address as Address,
    pageName: String(row.page_name || "Tobyworld Pouch"),
    description: row.description || null,
    theme: normalizeTheme(row.theme),
    featuredDeed: row.featured_deed ? String(row.featured_deed) : null,
    showWallet: row.show_wallet !== false,
    verified: Boolean(row.verified),
    xUrl: row.x_url || null,
    farcasterUrl: row.farcaster_url || null,
    websiteUrl: row.website_url || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export async function readPublicPouchProfile(
  slug: string,
  force = false,
): Promise<PublicPouchProfile | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;

  const cached = memory.get(clean);
  if (!force && cached && Date.now() - cached.at < MEMORY_MS) {
    return cached.value;
  }

  const supabase = publicSupabase();
  if (!supabase) return null;

  try {
    const response = await fetch(
      `${supabase.url}/rest/v1/tobyswap_public_pouches?slug=eq.${encodeURIComponent(clean)}&select=slug,wallet_address,page_name,description,theme,featured_deed,show_wallet,verified,x_url,farcaster_url,website_url,created_at,updated_at&limit=1`,
      {
        headers: {
          apikey: supabase.key,
          Authorization: `Bearer ${supabase.key}`,
        },
        cache: "force-cache",
      },
    );

    if (!response.ok) return null;
    const rows = await response.json();
    const value = rows?.[0] ? rowToProfile(rows[0]) : null;
    const entry = { at: Date.now(), value };
    memory.set(clean, entry);
    if (value) walletMemory.set(value.walletAddress.toLowerCase(), entry);
    return value;
  } catch {
    return null;
  }
}


export async function readPublicPouchProfileByWallet(
  walletAddress: string,
  force = false,
): Promise<PublicPouchProfile | null> {
  const clean = walletAddress.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(clean)) return null;

  const cached = walletMemory.get(clean);
  if (!force && cached && Date.now() - cached.at < MEMORY_MS) {
    return cached.value;
  }

  const supabase = publicSupabase();
  if (!supabase) return null;

  try {
    const response = await fetch(
      `${supabase.url}/rest/v1/tobyswap_public_pouches?wallet_address=eq.${encodeURIComponent(clean)}&select=slug,wallet_address,page_name,description,theme,featured_deed,show_wallet,verified,x_url,farcaster_url,website_url,created_at,updated_at&limit=1`,
      {
        headers: {
          apikey: supabase.key,
          Authorization: `Bearer ${supabase.key}`,
        },
        cache: "force-cache",
      },
    );

    if (!response.ok) return null;
    const rows = await response.json();
    const value = rows?.[0] ? rowToProfile(rows[0]) : null;
    const entry = { at: Date.now(), value };
    walletMemory.set(clean, entry);
    if (value) memory.set(value.slug.toLowerCase(), entry);
    return value;
  } catch {
    return null;
  }
}

export function rememberPublicPouchProfile(profile: PublicPouchProfile) {
  const entry = { at: Date.now(), value: profile };
  memory.set(profile.slug.toLowerCase(), entry);
  walletMemory.set(profile.walletAddress.toLowerCase(), entry);
}

export function editorStorageKey(wallet: string) {
  return `tobyswap:public-pouch-editor:v1:${wallet.toLowerCase()}`;
}

export function slugEditorStorageKey(slug: string) {
  return `tobyswap:public-pouch-secret:v1:${slug.toLowerCase()}`;
}

export function readLocalPouchEditor(wallet: string): LocalPouchEditor | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(editorStorageKey(wallet));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.slug !== "string" ||
      typeof parsed?.secret !== "string" ||
      parsed.secret.length < 24
    ) {
      return null;
    }
    return { slug: parsed.slug, secret: parsed.secret };
  } catch {
    return null;
  }
}

export function readLocalPouchEditorBySlug(slug: string): LocalPouchEditor | null {
  if (typeof window === "undefined") return null;
  try {
    const secret = localStorage.getItem(slugEditorStorageKey(slug));
    return secret && secret.length >= 24 ? { slug, secret } : null;
  } catch {
    return null;
  }
}

export function rememberLocalPouchEditor(
  wallet: string,
  editor: LocalPouchEditor,
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(editorStorageKey(wallet), JSON.stringify(editor));
    localStorage.setItem(slugEditorStorageKey(editor.slug), editor.secret);
  } catch {}
}

export function makeEditSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}
