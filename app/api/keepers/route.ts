import { NextResponse } from "next/server";
import { getKeeperDirectory } from "@/lib/keeper-directory-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const q = (params.get("q") || "").trim().toLowerCase();
    const limit = Math.max(1, Math.min(100, Number(params.get("limit") || 36)));
    const keepers = await getKeeperDirectory();
    const filtered = q
      ? keepers.filter((keeper) =>
          [
            keeper.keeperName,
            keeper.keeperSocial,
            keeper.ownerAddress,
            ...keeper.currentLands.flatMap((land) => [land.name, `#${land.tokenId}`, ...land.signs]),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : keepers;

    return NextResponse.json(
      { keepers: filtered.slice(0, limit), total: filtered.length },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
    );
  } catch {
    return NextResponse.json({ keepers: [], total: 0 }, { status: 200 });
  }
}
