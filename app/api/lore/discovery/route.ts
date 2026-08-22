import { NextResponse } from "next/server";
import { getLoreAtlasIndex } from "@/lib/lore-atlas-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const index = await getLoreAtlasIndex();
    return NextResponse.json(
      { total: index.lands.length, groups: index.discovery },
      { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } },
    );
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || "Discovery unavailable").slice(0, 180) }, { status: 502 });
  }
}
