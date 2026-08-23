import { NextResponse } from "next/server";
import { getKeeperDirectoryFresh } from "@/lib/keeper-directory-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const q = (params.get("q") || "").trim().toLowerCase();
    const limit = Math.max(
      1,
      Math.min(100, Number(params.get("limit") || 60)),
    );

    const keepers = await getKeeperDirectoryFresh();

    const filtered = q
      ? keepers.filter((keeper) =>
          [
            keeper.keeperName,
            keeper.keeperSocial,
            ...keeper.currentLands.flatMap((land) => [
              land.name,
              `#${land.tokenId}`,
              ...land.signs,
            ]),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : keepers;

    return NextResponse.json(
      {
        keepers: filtered.slice(0, limit),
        total: filtered.length,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("[api/keepers] Keeper directory failed:", error);

    // Do not silently pretend there are zero Keeper Marks when the request
    // itself failed. The client can keep its last good result and retry.
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
