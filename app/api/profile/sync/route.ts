import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { hasSupabaseServerEnv, supabaseRest } from "@/lib/supabase/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileBody = {
  walletAddress?: string;
  fid?: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
};

function cleanText(value: unknown, max = 80) {
  return typeof value === "string" ? value.trim().slice(0, max) || null : null;
}

function cleanPfp(value: unknown) {
  if (typeof value !== "string" || value.length > 1000) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ ok: false, skipped: true, reason: "Supabase not configured" });
  }

  try {
    const body = (await request.json()) as ProfileBody;
    if (!body.walletAddress || !isAddress(body.walletAddress)) {
      return NextResponse.json({ ok: false, error: "Invalid wallet address" }, { status: 400 });
    }
    if (!Number.isInteger(body.fid) || Number(body.fid) <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid Farcaster FID" }, { status: 400 });
    }

    const walletAddress = getAddress(body.walletAddress).toLowerCase();
    const fid = Number(body.fid);

    const existing = await supabaseRest<Array<{ wallet_address: string; fid: number }>>(
      `tobyswap_profile_wallets?wallet_address=eq.${encodeURIComponent(walletAddress)}&select=wallet_address,fid&limit=1`,
    );

    if (existing[0] && Number(existing[0].fid) !== fid) {
      // Never silently reassign a remembered wallet to a different FID.
      return NextResponse.json({ ok: false, conflict: true }, { status: 409 });
    }

    await supabaseRest("tobyswap_farcaster_profiles?on_conflict=fid", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: JSON.stringify({
        fid,
        username: cleanText(body.username, 64),
        display_name: cleanText(body.displayName, 120),
        pfp_url: cleanPfp(body.pfpUrl),
        updated_at: new Date().toISOString(),
      }),
    });

    await supabaseRest("tobyswap_profile_wallets?on_conflict=wallet_address", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: JSON.stringify({
        wallet_address: walletAddress,
        fid,
        last_seen_at: new Date().toISOString(),
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Unable to remember Farcaster profile" },
      { status: 500 },
    );
  }
}
