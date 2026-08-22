import { NextResponse } from "next/server";
import { getLoreAtlasIndex } from "@/lib/lore-atlas-server";
import { hasSupabaseServerEnv, supabaseRest } from "@/lib/supabase/rest";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
type HistoryRow = { token_id: string | number; keeper_name: string | null; community_name: string | null; became_previous_at: string | null };
export async function GET() {
  try {
    const atlas = await getLoreAtlasIndex();
    const recentMarks = atlas.lands.filter((land) => land.updatedAt && (land.keeperStory || land.keeperName || land.communityName)).sort((a,b) => Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || "")).slice(0, 8);
    let history: HistoryRow[] = [];
    if (hasSupabaseServerEnv()) { try { const query = new URLSearchParams({ select: "token_id,keeper_name,community_name,became_previous_at", order: "became_previous_at.desc", limit: "8" }); history = await supabaseRest<HistoryRow[]>(`tobyswap_land_keeper_history?${query.toString()}`); } catch {} }
    const events = [...recentMarks.map((land) => ({ type: "mark", tokenId: land.tokenId, title: land.communityName || `Lore Land #${land.tokenId}`, detail: land.keeperStory ? "A Keeper's Story was left here" : "A Keeper Mark was tended here", keeperName: land.keeperName, at: land.updatedAt, imageUrl: land.imageUrl })), ...history.filter((row) => row.became_previous_at).map((row) => ({ type: "keeper", tokenId: String(row.token_id), title: row.community_name || `Lore Land #${String(row.token_id)}`, detail: "The deed passed to a new keeper", keeperName: null, at: row.became_previous_at, imageUrl: atlas.byId[String(row.token_id)]?.imageUrl || null }))].filter((event) => event.at).sort((a,b) => Date.parse(b.at || "") - Date.parse(a.at || "")).slice(0, 10);
    return NextResponse.json({ events }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });
  } catch { return NextResponse.json({ events: [] }); }
}
