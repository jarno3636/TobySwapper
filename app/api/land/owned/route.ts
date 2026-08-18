import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { LORE_COLLECTION_ADDRESS } from "@/lib/lore-deeds";
import { hasSupabaseServerEnv, supabaseRest } from "@/lib/supabase/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OwnedNft = { tokenId?: string; tokenIdHex?: string };
type AlchemyBody = { ownedNfts?: OwnedNft[]; pageKey?: string };

function decimalTokenId(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  try { return BigInt(value).toString(); } catch { return null; }
}

async function profilesFor(tokenIds: string[]) {
  if (!hasSupabaseServerEnv() || tokenIds.length === 0) return new Map<string, { communityName: string | null; bannerTheme: string | null }>();
  try {
    const filter = tokenIds.map((id) => encodeURIComponent(id)).join(",");
    const rows = await supabaseRest<Array<{ token_id: string | number; community_name: string | null; banner_theme: string | null }>>(
      `tobyswap_land_profiles?token_id=in.(${filter})&select=token_id,community_name,banner_theme`,
    );
    return new Map(rows.map((row) => [String(row.token_id), { communityName: row.community_name, bannerTheme: row.banner_theme }]));
  } catch { return new Map(); }
}

async function fallbackFromProfiles(owner: string) {
  if (!hasSupabaseServerEnv()) return [];
  try {
    const rows = await supabaseRest<Array<{ token_id: string | number; community_name: string | null; banner_theme: string | null }>>(
      `tobyswap_land_profiles?owner_address=eq.${encodeURIComponent(owner.toLowerCase())}&select=token_id,community_name,banner_theme&order=token_id.asc&limit=100`,
    );
    return rows.map((row) => ({ tokenId: String(row.token_id), communityName: row.community_name, bannerTheme: row.banner_theme }));
  } catch { return []; }
}

export async function GET(request: Request) {
  const rawOwner = new URL(request.url).searchParams.get("owner") || "";
  if (!isAddress(rawOwner)) return NextResponse.json({ deeds: [], complete: false }, { status: 400 });
  const owner = getAddress(rawOwner);
  const key = process.env.ALCHEMY_API_KEY;

  if (!key) {
    const deeds = await fallbackFromProfiles(owner);
    return NextResponse.json({ deeds, complete: false }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
  }

  try {
    const tokenIds: string[] = [];
    let pageKey = "";
    for (let page = 0; page < 4; page += 1) {
      const url = new URL(`https://base-mainnet.g.alchemy.com/nft/v3/${encodeURIComponent(key)}/getNFTsForOwner`);
      url.searchParams.set("owner", owner);
      url.searchParams.append("contractAddresses[]", LORE_COLLECTION_ADDRESS);
      url.searchParams.set("withMetadata", "false");
      url.searchParams.set("pageSize", "100");
      if (pageKey) url.searchParams.set("pageKey", pageKey);

      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`Alchemy ${response.status}`);
      const body = await response.json() as AlchemyBody;
      for (const nft of body.ownedNfts || []) {
        const id = decimalTokenId(nft.tokenId ?? nft.tokenIdHex);
        if (id && !tokenIds.includes(id)) tokenIds.push(id);
      }
      pageKey = typeof body.pageKey === "string" ? body.pageKey : "";
      if (!pageKey) break;
    }

    const profiles = await profilesFor(tokenIds);
    const deeds = tokenIds
      .sort((a, b) => Number(BigInt(a) - BigInt(b)))
      .map((tokenId) => ({ tokenId, communityName: profiles.get(tokenId)?.communityName || null, bannerTheme: profiles.get(tokenId)?.bannerTheme || "moss" }));

    return NextResponse.json({ deeds, complete: !pageKey }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
  } catch {
    const deeds = await fallbackFromProfiles(owner);
    return NextResponse.json({ deeds, complete: false }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=900" } });
  }
}
