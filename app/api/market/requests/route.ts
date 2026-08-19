import { NextResponse } from "next/server";
import { createPublicClient, getAddress, http, isAddress, isHex } from "viem";
import { base } from "viem/chains";
import { requestMessage } from "@/lib/marketplace-requests";
import { hasSupabaseServerEnv, supabaseRest } from "@/lib/supabase/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org", { retryCount: 1, timeout: 10_000 }) });
const assets = new Set(["seed", "old-land", "lore-land"]);
const payments = new Set(["USDC", "ETH", "TOBY"]);

export async function POST(request: Request) {
  if (!hasSupabaseServerEnv()) return NextResponse.json({ ok: false, error: "Market requests are not configured." }, { status: 503 });
  try {
    const body = await request.json();
    if (!isAddress(body.requester || "") || !isHex(body.signature || "")) return NextResponse.json({ ok: false, error: "Invalid wallet signature." }, { status: 400 });
    const requester = getAddress(body.requester);
    const assetKind = String(body.assetKind || "");
    const payment = String(body.payment || "");
    const tokenId = /^\d+$/.test(String(body.tokenId || "")) ? String(body.tokenId) : "";
    const quantity = /^\d+$/.test(String(body.quantity || "")) ? String(body.quantity) : "1";
    const budgetAtomic = /^\d+$/.test(String(body.budgetAtomic || "")) ? String(body.budgetAtomic) : "0";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 180) : "";
    const timestamp = Number(body.timestamp);
    if (!assets.has(assetKind) || !payments.has(payment) || BigInt(budgetAtomic) <= 0n) return NextResponse.json({ ok: false, error: "Complete the request details first." }, { status: 400 });
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60_000) return NextResponse.json({ ok: false, error: "That request signature expired. Try again." }, { status: 400 });
    const message = requestMessage({ requester, assetKind: assetKind as any, tokenId, quantity, payment: payment as any, budgetAtomic, note, timestamp });
    const valid = await client.verifyMessage({ address: requester, message, signature: body.signature });
    if (!valid) return NextResponse.json({ ok: false, error: "The wallet signature did not match." }, { status: 401 });

    const active = await supabaseRest<any[]>(`tobyswap_market_requests?requester=eq.${requester.toLowerCase()}&status=eq.active&select=id&limit=13`);
    if (active.length >= 12) return NextResponse.json({ ok: false, error: "You already have 12 active requests. Close one before adding another." }, { status: 400 });

    await supabaseRest("tobyswap_market_requests", { method: "POST", prefer: "return=minimal", body: JSON.stringify({
      requester: requester.toLowerCase(), asset_kind: assetKind, token_id: tokenId || null,
      quantity, payment, budget_atomic: budgetAtomic, note: note || null, status: "active",
    }) });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Request could not be posted." }, { status: 500 });
  }
}
