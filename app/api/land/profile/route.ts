import { NextResponse } from "next/server";
import { createPublicClient, getAddress, http, isAddress, isHex } from "viem";
import { base } from "viem/chains";
import { LORE_COLLECTION_ADDRESS, LORE_DEEDS_ABI } from "@/lib/lore-deeds";
import { landProfileMessage, normalizeLandTheme } from "@/lib/land-profile";
import { hasSupabaseServerEnv, supabaseRest } from "@/lib/supabase/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org", {
    retryCount: 1,
    timeout: 10_000,
  }),
});

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(request: Request) {
  if (!hasSupabaseServerEnv()) return NextResponse.json({ profile: null });
  try {
    const tokenId = new URL(request.url).searchParams.get("tokenId") || "";
    if (!/^\d+$/.test(tokenId) || BigInt(tokenId) <= 0n) return NextResponse.json({ profile: null }, { status: 400 });
    const rows = await supabaseRest<Array<{ token_id: number | string; community_name: string | null; description: string | null; banner_theme: string | null; updated_at: string | null }>>(
      `tobyswap_land_profiles?token_id=eq.${encodeURIComponent(tokenId)}&select=token_id,community_name,description,banner_theme,updated_at&limit=1`,
    );
    return NextResponse.json({ profile: rows[0] || null }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ profile: null }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } });
  }
}

export async function POST(request: Request) {
  if (!hasSupabaseServerEnv()) return NextResponse.json({ ok: false, error: "Land memory is not configured yet." }, { status: 503 });
  try {
    const body = await request.json();
    const tokenId = typeof body.tokenId === "string" && /^\d+$/.test(body.tokenId) ? BigInt(body.tokenId) : 0n;
    if (tokenId <= 0n) return NextResponse.json({ ok: false, error: "Invalid deed." }, { status: 400 });
    if (!isAddress(body.signer || "")) return NextResponse.json({ ok: false, error: "Invalid keeper." }, { status: 400 });
    const signer = getAddress(body.signer);
    const communityName = text(body.communityName, 64);
    const description = text(body.description, 280);
    const bannerTheme = normalizeLandTheme(body.bannerTheme);
    const timestamp = Number(body.timestamp);
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60_000) {
      return NextResponse.json({ ok: false, error: "That land signature has expired. Try again." }, { status: 400 });
    }
    if (!isHex(body.signature || "")) return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 400 });
    const message = landProfileMessage({ tokenId, communityName, description, bannerTheme, timestamp });

    // IMPORTANT: use the Public Client verification action instead of viem's
    // standalone utility. Base App / Coinbase Smart Wallet can return ERC-1271
    // or ERC-6492 smart-account signatures, which are not necessarily the
    // standard 65-byte EOA signature shape. The standalone utility attempts to
    // parse those as an EOA signature and can throw "invalid signature length".
    // PublicClient.verifyMessage supports wallet/contract signature validation
    // against Base while still working for normal EOA signatures.
    let valid = false;
    try {
      valid = await client.verifyMessage({
        address: signer,
        message,
        signature: body.signature,
      });
    } catch {
      return NextResponse.json(
        { ok: false, error: "That wallet signature could not be verified. Please sign again." },
        { status: 401 },
      );
    }
    if (!valid) return NextResponse.json({ ok: false, error: "The keeper signature did not match." }, { status: 401 });

    const owner = await client.readContract({ address: LORE_COLLECTION_ADDRESS, abi: LORE_DEEDS_ABI, functionName: "ownerOf", args: [tokenId] });
    if (String(owner).toLowerCase() !== signer.toLowerCase()) {
      return NextResponse.json({ ok: false, error: "Only the current deed keeper can name this land." }, { status: 403 });
    }

    await supabaseRest("tobyswap_land_profiles?on_conflict=token_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: JSON.stringify({
        token_id: tokenId.toString(),
        owner_address: signer.toLowerCase(),
        community_name: communityName || null,
        description: description || null,
        banner_theme: bannerTheme,
        updated_at: new Date().toISOString(),
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "The land could not be saved." }, { status: 500 });
  }
}
