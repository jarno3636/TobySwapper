import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";

import { getKeeperOfTobySelf } from "@/lib/keeper-of-toby-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!isAddress(body?.walletAddress || "")) {
      return NextResponse.json(
        { keeper: null, error: "Invalid wallet." },
        { status: 400 },
      );
    }

    const wallet = getAddress(body.walletAddress).toLowerCase();
    const keeper = await getKeeperOfTobySelf(wallet);

    return NextResponse.json(
      { keeper },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      { keeper: null, error: error?.message || "Keeper registry unavailable." },
      { status: 500 },
    );
  }
}
