import { NextResponse } from "next/server";
import { hasSupabaseServerEnv, supabaseRest } from "@/lib/supabase/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasSupabaseServerEnv()) return NextResponse.json({ lands: [] }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400" } });
  try {
    const lands = await supabaseRest(
      "tobyswap_land_profiles?select=token_id,community_name,description,keeper_name,keeper_social,banner_theme,updated_at&order=updated_at.desc&limit=120",
    );
    return NextResponse.json({ lands }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ lands: [] }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=3600" } });
  }
}
