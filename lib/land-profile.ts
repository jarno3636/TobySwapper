export type LandBannerTheme = "moss" | "moon" | "lotus" | "ember" | "tide" | "dusk" | "bloom" | "gold";

export type LandCommunityProfile = {
  tokenId: string;
  ownerAddress: string | null;
  transferNonce: string | null;
  communityName: string | null;
  description: string | null;
  keeperName: string | null;
  keeperSocial: string | null;
  keeperLink: string | null;
  bannerTheme: LandBannerTheme;
  updatedAt: string | null;
};

const THEMES: LandBannerTheme[] = ["moss", "moon", "lotus", "ember", "tide", "dusk", "bloom", "gold"];
const memory = new Map<string, { at: number; profile: LandCommunityProfile | null }>();
const MEMORY_MS = 15 * 60_000;

export function normalizeLandTheme(value: unknown): LandBannerTheme {
  return THEMES.includes(value as LandBannerTheme) ? (value as LandBannerTheme) : "moss";
}

function toProfile(row: any, cacheKey: string): LandCommunityProfile {
  return {
    tokenId: String(row.token_id ?? row.tokenId ?? cacheKey),
    ownerAddress: row.owner_address ?? row.ownerAddress ?? null,
    transferNonce: row.transfer_nonce == null ? null : String(row.transfer_nonce),
    communityName: row.community_name ?? row.communityName ?? null,
    description: row.description ?? null,
    keeperName: row.keeper_name ?? row.keeperName ?? null,
    keeperSocial: row.keeper_social ?? row.keeperSocial ?? null,
    keeperLink: row.keeper_link ?? row.keeperLink ?? null,
    bannerTheme: normalizeLandTheme(row.banner_theme ?? row.bannerTheme),
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

export async function readPublicLandProfile(tokenId: bigint): Promise<LandCommunityProfile | null> {
  const cacheKey = tokenId.toString();
  const cached = memory.get(cacheKey);
  if (cached && Date.now() - cached.at < MEMORY_MS) return cached.profile;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const select = "token_id,owner_address,transfer_nonce,community_name,description,keeper_name,keeper_social,keeper_link,banner_theme,updated_at";

  try {
    let response: Response;
    if (url && key) {
      response = await fetch(
        `${url}/rest/v1/tobyswap_land_profiles?token_id=eq.${cacheKey}&select=${select}&limit=1`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "force-cache" },
      );
    } else {
      response = await fetch(`/api/land/profile?tokenId=${encodeURIComponent(cacheKey)}`, { cache: "force-cache" });
    }
    if (!response.ok) return null;
    const body = await response.json();
    const row = Array.isArray(body) ? body[0] : body?.profile;
    if (!row) {
      memory.set(cacheKey, { at: Date.now(), profile: null });
      return null;
    }
    const profile = toProfile(row, cacheKey);
    memory.set(cacheKey, { at: Date.now(), profile });
    return profile;
  } catch {
    return null;
  }
}

export function rememberPublicLandProfile(profile: LandCommunityProfile) {
  memory.set(profile.tokenId, { at: Date.now(), profile });
}

export function landProfileMessage(input: {
  tokenId: bigint;
  transferNonce: bigint;
  communityName: string;
  description: string;
  keeperName: string;
  keeperSocial: string;
  keeperLink: string;
  bannerTheme: LandBannerTheme;
  timestamp: number;
}) {
  return [
    "TobySwap Keeper Mark",
    `Deed: ${input.tokenId.toString()}`,
    `Generation: ${input.transferNonce.toString()}`,
    `Land name: ${input.communityName.trim()}`,
    `Keeper story: ${input.description.trim()}`,
    `Keeper name: ${input.keeperName.trim()}`,
    `Keeper social: ${input.keeperSocial.trim()}`,
    `Keeper link: ${input.keeperLink.trim()}`,
    `Banner: ${input.bannerTheme}`,
    `Timestamp: ${input.timestamp}`,
  ].join("\n");
}
