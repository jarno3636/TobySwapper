import { NextResponse } from "next/server";
import { hasSupabaseServerEnv, supabaseRest } from "@/lib/supabase/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HISTORY_SELECT = "id,token_id,owner_address,transfer_nonce,community_name,description,keeper_name,keeper_social,keeper_link,banner_theme,became_previous_at,created_at";

export async function GET(request: Request) {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ history: [] });
  }

  try {
    const tokenId = new URL(request.url).searchParams.get("tokenId") || "";
    if (!/^\d+$/.test(tokenId) || BigInt(tokenId) <= 0n) {
      return NextResponse.json({ history: [] }, { status: 400 });
    }

    const rows = await supabaseRest<Array<Record<string, unknown>>>(
      `tobyswap_land_keeper_history?token_id=eq.${encodeURIComponent(tokenId)}&select=${HISTORY_SELECT}&order=became_previous_at.desc&limit=12`,
    );

    return NextResponse.json(
      { history: rows || [] },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
    );
  } catch {
    return NextResponse.json(
      { history: [] },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  }
}
