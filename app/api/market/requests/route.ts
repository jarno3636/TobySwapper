import { NextResponse } from "next/server";
import { createPublicClient, getAddress, http, isAddress, isHex } from "viem";
import { base } from "viem/chains";
import { parseUnits } from "viem";
import { hasSupabaseServerEnv, supabaseRest } from "@/lib/supabase/rest";
import { MARKETPLACE_ASSETS, MARKETPLACE_PAYMENTS, type MarketplaceAssetKind, type MarketplacePayment } from "@/lib/land-exchange";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org", {
    retryCount: 1,
    timeout: 10_000,
  }),
});

const VALID_ASSETS = new Set<MarketplaceAssetKind>(["seed", "old-land", "lore-land"]);
const VALID_PAYMENTS = new Set<MarketplacePayment>(["USDC", "ETH", "TOBY"]);

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function requestMessage(input: {
  requester: string;
  assetKind: MarketplaceAssetKind;
  tokenId: string;
  quantity: string;
  payment: MarketplacePayment;
  budgetAtomic: string;
  note: string;
  expiresAt: string;
  nonce: string;
  timestamp: number;
}) {
  return [
    "Tobyworld Market Request",
    `Requester: ${input.requester.toLowerCase()}`,
    `Asset: ${input.assetKind}`,
    `Token ID: ${input.tokenId}`,
    `Quantity: ${input.quantity}`,
    `Payment: ${input.payment}`,
    `Budget: ${input.budgetAtomic}`,
    `Note: ${input.note.trim()}`,
    `Expires: ${input.expiresAt}`,
    `Nonce: ${input.nonce}`,
    `Timestamp: ${input.timestamp}`,
  ].join("\n");
}

function cancelMessage(input: { requester: string; requestId: string; timestamp: number }) {
  return [
    "Cancel Tobyworld Market Request",
    `Requester: ${input.requester.toLowerCase()}`,
    `Request: ${input.requestId}`,
    `Timestamp: ${input.timestamp}`,
  ].join("\n");
}

async function verify(address: `0x${string}`, message: string, signature: `0x${string}`) {
  try {
    return await client.verifyMessage({ address, message, signature });
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ ok: false, error: "Market requests are not configured yet." }, { status: 503 });
  }

  try {
    const body = await request.json();
    if (!isAddress(body.requester || "")) return NextResponse.json({ ok: false, error: "Invalid wallet." }, { status: 400 });
    if (!isHex(body.signature || "")) return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 400 });

    const requester = getAddress(body.requester);
    const timestamp = Number(body.timestamp);
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60_000) {
      return NextResponse.json({ ok: false, error: "That signature expired. Try again." }, { status: 400 });
    }

    // Cancellation is explicit and wallet-signed.
    if (body.action === "cancel") {
      const requestId = cleanText(body.requestId, 80);
      if (!requestId) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
      const valid = await verify(requester, cancelMessage({ requester, requestId, timestamp }), body.signature);
      if (!valid) return NextResponse.json({ ok: false, error: "Signature did not match." }, { status: 401 });

      await supabaseRest(
        `tobyswap_market_requests?id=eq.${encodeURIComponent(requestId)}&requester=eq.${encodeURIComponent(requester.toLowerCase())}&status=eq.active`,
        {
          method: "PATCH",
          prefer: "return=minimal",
          body: JSON.stringify({ status: "cancelled", updated_at: new Date().toISOString() }),
        },
      );
      return NextResponse.json({ ok: true });
    }

    const assetKind = body.assetKind as MarketplaceAssetKind;
    const payment = body.payment as MarketplacePayment;
    if (!VALID_ASSETS.has(assetKind) || !VALID_PAYMENTS.has(payment)) {
      return NextResponse.json({ ok: false, error: "Unsupported market request." }, { status: 400 });
    }

    const asset = MARKETPLACE_ASSETS.find((item) => item.id === assetKind)!;
    const paymentConfig = MARKETPLACE_PAYMENTS.find((item) => item.id === payment)!;
    const tokenId = cleanText(body.tokenId, 40);
    const quantity = cleanText(body.quantity, 60);
    const note = cleanText(body.note, 140);
    const nonce = cleanText(body.nonce, 80);
    const expiresAt = cleanText(body.expiresAt, 40);
    const budget = cleanText(body.budget, 80);

    if (!nonce || !budget || !/^\d+(\.\d+)?$/.test(budget)) {
      return NextResponse.json({ ok: false, error: "Enter a valid budget." }, { status: 400 });
    }
    if (asset.quantityBased) {
      if (!/^\d+$/.test(quantity) || BigInt(quantity) <= 0n) {
        return NextResponse.json({ ok: false, error: "Enter a SEED quantity." }, { status: 400 });
      }
    } else if (tokenId && !/^\d+$/.test(tokenId)) {
      return NextResponse.json({ ok: false, error: "Deed ID must be a number or left blank for any deed." }, { status: 400 });
    }

    const expiresMs = Date.parse(expiresAt);
    if (!Number.isFinite(expiresMs) || expiresMs <= Date.now() + 60_000 || expiresMs > Date.now() + 30 * 24 * 60 * 60_000) {
      return NextResponse.json({ ok: false, error: "Request expiry must be between 1 minute and 30 days." }, { status: 400 });
    }

    let budgetAtomic: bigint;
    try {
      budgetAtomic = parseUnits(budget, paymentConfig.decimals);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid budget." }, { status: 400 });
    }
    if (budgetAtomic <= 0n) return NextResponse.json({ ok: false, error: "Budget must be above zero." }, { status: 400 });

    const message = requestMessage({
      requester,
      assetKind,
      tokenId,
      quantity,
      payment,
      budgetAtomic: budgetAtomic.toString(),
      note,
      expiresAt: new Date(expiresMs).toISOString(),
      nonce,
      timestamp,
    });
    const valid = await verify(requester, message, body.signature);
    if (!valid) return NextResponse.json({ ok: false, error: "Signature did not match." }, { status: 401 });

    // Keep the board useful and cheap: max 12 live requests per wallet.
    const existing = await supabaseRest<Array<{ id: string }>>(
      `tobyswap_market_requests?requester=eq.${encodeURIComponent(requester.toLowerCase())}&status=eq.active&select=id&limit=13`,
    );
    if (existing.length >= 12) {
      return NextResponse.json({ ok: false, error: "You already have 12 active requests. Cancel one first." }, { status: 429 });
    }

    const rows = await supabaseRest<Array<{ id: string }>>("tobyswap_market_requests", {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify({
        requester: requester.toLowerCase(),
        asset_kind: assetKind,
        asset_address: asset.address.toLowerCase(),
        token_id: tokenId || null,
        quantity: asset.quantityBased ? quantity : "1",
        payment_symbol: payment,
        payment_token: paymentConfig.address ? paymentConfig.address.toLowerCase() : null,
        budget_atomic: budgetAtomic.toString(),
        note: note || null,
        status: "active",
        expires_at: new Date(expiresMs).toISOString(),
        client_nonce: nonce,
      }),
    });

    return NextResponse.json({ ok: true, id: rows?.[0]?.id || null });
  } catch (error: any) {
    const message = String(error?.message || "Could not save request.");
    if (message.includes("client_nonce")) return NextResponse.json({ ok: false, error: "That request was already submitted." }, { status: 409 });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
