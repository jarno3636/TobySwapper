import { NextResponse } from "next/server";
import { SWAPPER, TOBY } from "@/lib/addresses";
import { getCachedBurnTotal } from "@/lib/server/burn-total";

export const runtime = "nodejs";
export const revalidate = 900;

export async function GET() {
  try {
    const total = await getCachedBurnTotal();
    return NextResponse.json(
      { ok: true, source: "TobySwapper.totalTobyBurned", swapper: SWAPPER, toby: TOBY, decimals: 18, ...total },
      { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600", "X-Robots-Tag": "noindex, nofollow" } },
    );
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Burn total unavailable" }, { status: 503, headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  }
}
