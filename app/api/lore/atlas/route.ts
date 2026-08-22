import { NextRequest, NextResponse } from "next/server";
import { getLoreAtlasIndex, landHasTrait, landMatchesQuery } from "@/lib/lore-atlas-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const q = (params.get("q") || "").slice(0, 100);
    const traitType = (params.get("traitType") || "").slice(0, 80);
    const traitValue = (params.get("traitValue") || "").slice(0, 120);
    const page = Math.max(1, Number(params.get("page") || 1) || 1);
    const limit = Math.min(60, Math.max(12, Number(params.get("limit") || 36) || 36));

    const index = await getLoreAtlasIndex();
    const filtered = index.lands.filter(
      (land) => landMatchesQuery(land, q) && landHasTrait(land, traitType, traitValue),
    );
    const start = (page - 1) * limit;
    const lands = filtered.slice(start, start + limit);

    return NextResponse.json(
      {
        lands,
        total: filtered.length,
        collectionTotal: index.lands.length,
        page,
        pageCount: Math.max(1, Math.ceil(filtered.length / limit)),
      },
      { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=21600" } },
    );
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "Atlas unavailable").slice(0, 180) }, { status: 502 });
  }
}
