import { NextResponse } from "next/server";
import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  isHex,
} from "viem";
import { base } from "viem/chains";

import {
  keeperProfileMessage,
  normalizeKeeperHandle,
} from "@/lib/keeper-of-toby-profile";
import { getKeeperOfTobySelf } from "@/lib/keeper-of-toby-server";
import { hasSupabaseServerEnv, supabaseRest } from "@/lib/supabase/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const verifier = createPublicClient({
  chain: base,
  transport: http(),
});

function validHandle(value: string) {
  return !value || /^[A-Za-z0-9_]{1,32}$/.test(value);
}

export async function POST(request: Request) {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json(
      { ok: false, error: "Keeper registry is not configured." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();

    if (!isAddress(body?.signer || "")) {
      return NextResponse.json({ ok: false, error: "Invalid wallet." }, { status: 400 });
    }

    const signer = getAddress(body.signer).toLowerCase();
    const tokenId = Number(body.tokenId);
    const timestamp = Number(body.timestamp);
    const xHandle = normalizeKeeperHandle(body.xHandle);
    const telegramHandle = normalizeKeeperHandle(body.telegramHandle);

    if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > 111) {
      return NextResponse.json({ ok: false, error: "Invalid Keeper edition." }, { status: 400 });
    }

    if (!validHandle(xHandle) || !validHandle(telegramHandle)) {
      return NextResponse.json(
        { ok: false, error: "Handles may contain only letters, numbers, and underscores." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60_000) {
      return NextResponse.json(
        { ok: false, error: "That Keeper signature expired. Try again." },
        { status: 400 },
      );
    }

    if (!isHex(body?.signature || "")) {
      return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 400 });
    }

    const keeper = await getKeeperOfTobySelf(signer);

    if (!keeper || keeper.tokenId !== tokenId) {
      return NextResponse.json(
        { ok: false, error: "This wallet is not the registered recipient of that Keeper." },
        { status: 403 },
      );
    }

    const message = keeperProfileMessage({
      tokenId,
      signer,
      xHandle,
      telegramHandle,
      timestamp,
    });

    const valid = await verifier.verifyMessage({
      address: getAddress(signer),
      message,
      signature: body.signature,
    });

    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "The Keeper signature did not match this wallet." },
        { status: 401 },
      );
    }

    await supabaseRest(
      `tobyswap_keeper_of_toby?token_id=eq.${tokenId}`,
      {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify({
          x_handle: xHandle || null,
          telegram_handle: telegramHandle || null,
          social_updated_at: new Date().toISOString(),
        }),
      },
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Keeper profile could not be saved." },
      { status: 500 },
    );
  }
}
