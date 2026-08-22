import { NextRequest, NextResponse } from "next/server";
import { getLoreAtlasIndex, sharedSigns } from "@/lib/lore-atlas-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const tokenId = request.nextUrl.searchParams.get("tokenId") || "";
  if (!/^\d+$/.test(tokenId)) return NextResponse.json({ error: "Invalid tokenId" }, { status: 400 });

  try {
    const index = await getLoreAtlasIndex();
    const related = sharedSigns(index, tokenId, 6).map(({ land, shared }) => ({
      ...land,
      shared,
      sharedCount: shared.length,
    }));
    return NextResponse.json(
      { tokenId, related },
      { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=21600" } },
    );
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "Shared signs unavailable").slice(0, 180) }, { status: 502 });
  }
}
