import { NextResponse } from "next/server";
import {
  getKeeperDirectoryFresh,
  searchKeeperDirectoryFresh,
} from "@/lib/keeper-directory-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const q = (params.get("q") || "").trim();
    const limit = Math.max(
      1,
      Math.min(100, Number(params.get("limit") || 60)),
    );

    const keepers = q
      ? await searchKeeperDirectoryFresh(q)
      : await getKeeperDirectoryFresh();

    return NextResponse.json(
      {
        keepers: keepers.slice(0, limit),
        total: keepers.length,
        query: q || null,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("[api/keepers] Keeper directory failed:", error);

    return NextResponse.json(
      {
        keepers: [],
        total: 0,
        error: "Keeper Marks could not be loaded right now.",
      },
      { status: 503 },
    );
  }
}
