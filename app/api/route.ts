import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { hasSupabaseServerEnv, supabaseRest } from "@/lib/supabase/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THEMES = new Set(["pond", "moss", "moon", "lotus", "ember", "tide"]);
const burst = new Map<string, number[]>();

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function optionalUrl(value: unknown) {
  const input = text(value, 220);
  if (!input) return null;
  try {
    const url = new URL(input);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function equalHash(left: string, right: string) {
  try {
    const a = Buffer.from(left, "hex");
    const b = Buffer.from(right, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  return forwarded || real || "unknown";
}

function withinBurstLimit(request: Request) {
  const key = clientKey(request);
  const now = Date.now();
  const recent = (burst.get(key) || []).filter((at) => now - at < 60_000);
  if (recent.length >= 8) return false;
  recent.push(now);
  burst.set(key, recent);
  return true;
}

function cleanTheme(value: unknown) {
  return THEMES.has(String(value)) ? String(value) : "pond";
}

function cleanFeaturedDeed(value: unknown) {
  const raw = text(value, 10);
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  const id = BigInt(raw);
  return id >= 1n && id <= 4000n ? raw : null;
}

function profilePayload(body: any) {
  return {
    page_name: text(body.pageName, 56) || "Tobyworld Pouch",
    description: text(body.description, 240) || null,
    theme: cleanTheme(body.theme),
    featured_deed: cleanFeaturedDeed(body.featuredDeed),
    show_wallet: body.showWallet !== false,
    x_url: optionalUrl(body.xUrl),
    farcaster_url: optionalUrl(body.farcasterUrl),
    website_url: optionalUrl(body.websiteUrl),
    updated_at: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json(
      { ok: false, error: "Public Pouch memory is not configured." },
      { status: 503 },
    );
  }

  if (!withinBurstLimit(request)) {
    return NextResponse.json(
      { ok: false, error: "Too many profile changes. Wait a minute and try again." },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const action = body?.action === "update" ? "update" : "create";
    const secret = text(body?.secret, 160);

    if (secret.length < 32) {
      return NextResponse.json(
        { ok: false, error: "Missing private edit key." },
        { status: 400 },
      );
    }

    if (action === "create") {
      if (!isAddress(body?.walletAddress || "")) {
        return NextResponse.json(
          { ok: false, error: "Enter a valid Base wallet address." },
          { status: 400 },
        );
      }

      const wallet = getAddress(body.walletAddress).toLowerCase();

      // Keep no-login creation useful without allowing one wallet to generate an
      // unlimited number of rows. A verified profile can be added later without
      // changing this public-page model.
      const existing = await supabaseRest<Array<{ slug: string }>>(
        `tobyswap_public_pouches?wallet_address=eq.${encodeURIComponent(wallet)}&select=slug&limit=3`,
      );

      if (existing.length >= 3) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "This wallet already has several public Pouch pages. Open one from the browser where it was created or verify the wallet later to recover it.",
          },
          { status: 409 },
        );
      }

      const slug = `pond-${randomBytes(5).toString("hex")}`;
      const payload = profilePayload(body);

      await supabaseRest("tobyswap_public_pouches", {
        method: "POST",
        prefer: "return=minimal",
        body: JSON.stringify({
          slug,
          wallet_address: wallet,
          ...payload,
          verified: false,
          edit_secret_hash: hashSecret(secret),
          created_at: new Date().toISOString(),
        }),
      });

      return NextResponse.json({
        ok: true,
        slug,
        profile: {
          slug,
          walletAddress: wallet,
          pageName: payload.page_name,
          description: payload.description,
          theme: payload.theme,
          featuredDeed: payload.featured_deed,
          showWallet: payload.show_wallet,
          verified: false,
          xUrl: payload.x_url,
          farcasterUrl: payload.farcaster_url,
          websiteUrl: payload.website_url,
        },
      });
    }

    const slug = text(body?.slug, 40).toLowerCase();
    if (!/^pond-[a-f0-9]{10}$/.test(slug)) {
      return NextResponse.json(
        { ok: false, error: "Invalid public page." },
        { status: 400 },
      );
    }

    const rows = await supabaseRest<
      Array<{ slug: string; wallet_address: string; edit_secret_hash: string }>
    >(
      `tobyswap_public_pouches?slug=eq.${encodeURIComponent(slug)}&select=slug,wallet_address,edit_secret_hash&limit=1`,
    );

    const row = rows[0];
    if (!row || !equalHash(hashSecret(secret), row.edit_secret_hash)) {
      return NextResponse.json(
        { ok: false, error: "This browser does not have the private edit key for that page." },
        { status: 403 },
      );
    }

    const payload = profilePayload(body);

    await supabaseRest(`tobyswap_public_pouches?slug=eq.${encodeURIComponent(slug)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify(payload),
    });

    return NextResponse.json({
      ok: true,
      slug,
      profile: {
        slug,
        walletAddress: row.wallet_address,
        pageName: payload.page_name,
        description: payload.description,
        theme: payload.theme,
        featuredDeed: payload.featured_deed,
        showWallet: payload.show_wallet,
        verified: false,
        xUrl: payload.x_url,
        farcasterUrl: payload.farcaster_url,
        websiteUrl: payload.website_url,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "The public Pouch could not be saved.").slice(0, 240) },
      { status: 500 },
    );
  }
}
