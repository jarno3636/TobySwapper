import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NeynarUser = {
  fid?: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
  custody_address?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = url.searchParams.get("address") || "";
  if (!isAddress(address)) {
    return NextResponse.json({ ok: false, error: "Invalid address" }, { status: 400 });
  }

  const apiKey = process.env.NEYNAR_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: true, profile: null, configured: false });
  }

  try {
    const wallet = getAddress(address).toLowerCase();
    const endpoint = new URL("https://api.neynar.com/v2/farcaster/user/bulk-by-address/");
    endpoint.searchParams.set("addresses", wallet);

    const response = await fetch(endpoint, {
      headers: { Accept: "application/json", "x-api-key": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Neynar ${response.status}: ${(await response.text()).slice(0, 160)}`);
    }

    const payload = (await response.json()) as Record<string, NeynarUser[]>;
    const entry = Object.entries(payload || {}).find(([key]) => key.toLowerCase() === wallet);
    const users = Array.isArray(entry?.[1]) ? entry![1].filter((user) => Number(user?.fid) > 0) : [];
    const custody = users.find((user) => user.custody_address?.toLowerCase() === wallet);
    const user = custody || (users.length === 1 ? users[0] : undefined);

    if (!user?.fid) {
      return NextResponse.json({ ok: true, profile: null, ambiguous: users.length > 1 });
    }

    return NextResponse.json(
      {
        ok: true,
        profile: {
          fid: Number(user.fid),
          username: user.username || undefined,
          displayName: user.display_name || undefined,
          pfpUrl: user.pfp_url || undefined,
        },
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" } },
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Unable to resolve Farcaster identity" },
      { status: 502 },
    );
  }
}
