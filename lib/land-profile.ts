export type LandBannerTheme = "moss" | "moon" | "lotus" | "ember";

export type LandCommunityProfile = {
  tokenId: string;
  communityName: string | null;
  description: string | null;
  bannerTheme: LandBannerTheme;
  updatedAt: string | null;
};

const THEMES: LandBannerTheme[] = ["moss", "moon", "lotus", "ember"];
const memory = new Map<string, { at: number; profile: LandCommunityProfile | null }>();
const MEMORY_MS = 5 * 60_000;

export function normalizeLandTheme(value: unknown): LandBannerTheme {
  return THEMES.includes(value as LandBannerTheme) ? (value as LandBannerTheme) : "moss";
}

export async function readPublicLandProfile(tokenId: bigint): Promise<LandCommunityProfile | null> {
  const cacheKey = tokenId.toString();
  const cached = memory.get(cacheKey);
  if (cached && Date.now() - cached.at < MEMORY_MS) return cached.profile;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    let response: Response;
    if (url && key) {
      response = await fetch(
        `${url}/rest/v1/tobyswap_land_profiles?token_id=eq.${cacheKey}&select=token_id,community_name,description,banner_theme,updated_at&limit=1`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
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
    const profile: LandCommunityProfile = {
      tokenId: String(row.token_id ?? row.tokenId ?? cacheKey),
      communityName: row.community_name ?? row.communityName ?? null,
      description: row.description ?? null,
      bannerTheme: normalizeLandTheme(row.banner_theme ?? row.bannerTheme),
      updatedAt: row.updated_at ?? row.updatedAt ?? null,
    };
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
  communityName: string;
  description: string;
  bannerTheme: LandBannerTheme;
  timestamp: number;
}) {
  return [
    "TobySwap Land Profile",
    `Deed: ${input.tokenId.toString()}`,
    `Name: ${input.communityName.trim()}`,
    `Description: ${input.description.trim()}`,
    `Banner: ${input.bannerTheme}`,
    `Timestamp: ${input.timestamp}`,
  ].join("\n");
}
