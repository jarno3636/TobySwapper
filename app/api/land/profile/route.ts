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
    retryCount: 2,
    timeout: 12_000,
  }),
});

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const PROFILE_SELECT = "token_id,owner_address,transfer_nonce,community_name,description,keeper_name,keeper_social,keeper_link,banner_theme,updated_at";

export async function GET(request: Request) {
  if (!hasSupabaseServerEnv()) return NextResponse.json({ profile: null });
  try {
    const tokenId = new URL(request.url).searchParams.get("tokenId") || "";
    if (!/^\d+$/.test(tokenId) || BigInt(tokenId) <= 0n) return NextResponse.json({ profile: null }, { status: 400 });
    const rows = await supabaseRest<Array<Record<string, unknown>>>(
      `tobyswap_land_profiles?token_id=eq.${encodeURIComponent(tokenId)}&select=${PROFILE_SELECT}&limit=1`,
    );
    return NextResponse.json({ profile: rows[0] || null }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=3600" } });
  } catch {
    return NextResponse.json({ profile: null }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" } });
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
    const description = text(body.description, 800);
    const keeperName = text(body.keeperName, 64);
    const keeperSocial = text(body.keeperSocial, 80);
    const keeperLink = text(body.keeperLink, 240);
    const bannerTheme = normalizeLandTheme(body.bannerTheme);
    const timestamp = Number(body.timestamp);
    const transferNonce = typeof body.transferNonce === "string" && /^\d+$/.test(body.transferNonce) ? BigInt(body.transferNonce) : -1n;

    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60_000) {
      return NextResponse.json({ ok: false, error: "That Keeper Mark signature has expired. Try again." }, { status: 400 });
    }
    if (transferNonce < 0n) return NextResponse.json({ ok: false, error: "Missing deed generation." }, { status: 400 });
    if (!isHex(body.signature || "")) return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 400 });

    const [owner, currentNonce] = await Promise.all([
      client.readContract({ address: LORE_COLLECTION_ADDRESS, abi: LORE_DEEDS_ABI, functionName: "ownerOf", args: [tokenId] }),
      client.readContract({ address: LORE_COLLECTION_ADDRESS, abi: LORE_DEEDS_ABI, functionName: "transferNonce", args: [tokenId] }),
    ]);

    if (String(owner).toLowerCase() !== signer.toLowerCase()) {
      return NextResponse.json({ ok: false, error: "Only the current keeper can write for this land." }, { status: 403 });
    }
    if (BigInt(currentNonce) !== transferNonce) {
      return NextResponse.json({ ok: false, error: "This deed changed keepers. Refresh the land before saving." }, { status: 409 });
    }

    const message = landProfileMessage({
      tokenId,
      transferNonce,
      communityName,
      description,
      keeperName,
      keeperSocial,
      keeperLink,
      bannerTheme,
      timestamp,
    });

    let valid = false;
    try {
      valid = await client.verifyMessage({ address: signer, message, signature: body.signature });
    } catch {
      return NextResponse.json({ ok: false, error: "That wallet signature could not be verified. Please sign again." }, { status: 401 });
    }
    if (!valid) return NextResponse.json({ ok: false, error: "The Keeper Mark signature did not match." }, { status: 401 });

    // Preserve the prior keeper generation before replacing the active community layer.
    const existing = await supabaseRest<Array<any>>(
      `tobyswap_land_profiles?token_id=eq.${tokenId.toString()}&select=${PROFILE_SELECT}&limit=1`,
    ).catch(() => []);
    const prior = existing[0];
    const generationChanged = prior && (
      String(prior.owner_address || "").toLowerCase() !== signer.toLowerCase() ||
      String(prior.transfer_nonce ?? "") !== transferNonce.toString()
    );

    if (generationChanged) {
      await supabaseRest("tobyswap_land_keeper_history", {
        method: "POST",
        prefer: "return=minimal",
        body: JSON.stringify({
          token_id: tokenId.toString(),
          owner_address: prior.owner_address,
          transfer_nonce: prior.transfer_nonce,
          community_name: prior.community_name,
          description: prior.description,
          keeper_name: prior.keeper_name,
          keeper_social: prior.keeper_social,
          keeper_link: prior.keeper_link,
          banner_theme: prior.banner_theme,
          became_previous_at: new Date().toISOString(),
        }),
      }).catch(() => undefined);
    }

    await supabaseRest("tobyswap_land_profiles?on_conflict=token_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: JSON.stringify({
        token_id: tokenId.toString(),
        owner_address: signer.toLowerCase(),
        transfer_nonce: transferNonce.toString(),
        community_name: communityName || null,
        description: description || null,
        keeper_name: keeperName || null,
        keeper_social: keeperSocial || null,
        keeper_link: keeperLink || null,
        banner_theme: bannerTheme,
        updated_at: new Date().toISOString(),
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "The land could not be saved." }, { status: 500 });
  }
}
