import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { LORE_COLLECTION_ADDRESS } from "@/lib/lore-deeds";
import { extractLoreTraits } from "@/lib/lore-metadata-shared";
import { hasSupabaseServerEnv, supabaseRest } from "@/lib/supabase/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED_TOTAL = 2869;
const PAGE_SIZE = 1000;

type LoreRow = {
  token_id: string | number;
  metadata: Record<string, unknown> | null;
  revealed: boolean | null;
};

type FrequencyCache = {
  total: number;
  counts: Record<string, number>;
};

function normalizePart(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function traitKey(label: unknown, value: unknown) {
  return `${normalizePart(label)}::${normalizePart(value)}`;
}

const loadCollectionFrequency = unstable_cache(
  async (): Promise<FrequencyCache> => {
    if (!hasSupabaseServerEnv()) throw new Error("Supabase server environment is not configured");

    const rows: LoreRow[] = [];
    const collection = LORE_COLLECTION_ADDRESS.toLowerCase();

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const query = new URLSearchParams({
        collection_address: `eq.${collection}`,
        revealed: "eq.true",
        select: "token_id,metadata,revealed",
        order: "token_id.asc",
      });

      const page = await supabaseRest<LoreRow[]>(`tobyswap_lore_tokens?${query.toString()}`, {
        headers: { Range: `${offset}-${offset + PAGE_SIZE - 1}` },
      });

      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    const counts: Record<string, number> = {};

    for (const row of rows) {
      if (!row.metadata) continue;
      const seen = new Set<string>();

      for (const trait of extractLoreTraits(row.metadata)) {
        const key = traitKey(trait.trait_type, trait.value);
        if (!key || key === "::" || seen.has(key)) continue;
        seen.add(key);
        counts[key] = (counts[key] || 0) + 1;
      }
    }

    return {
      total: rows.length || EXPECTED_TOTAL,
      counts,
    };
  },
  ["tobyswap-lore-trait-frequency-v1"],
  { revalidate: 21600 },
);

export async function GET(request: NextRequest) {
  const tokenIdText = request.nextUrl.searchParams.get("tokenId") || "";
  if (!/^\d+$/.test(tokenIdText)) {
    return NextResponse.json({ error: "Invalid tokenId." }, { status: 400 });
  }

  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ error: "Rarity data is unavailable." }, { status: 503 });
  }

  try {
    const collection = LORE_COLLECTION_ADDRESS.toLowerCase();
    const query = new URLSearchParams({
      collection_address: `eq.${collection}`,
      token_id: `eq.${tokenIdText}`,
      select: "token_id,metadata,revealed",
      limit: "1",
    });

    const [rows, frequency] = await Promise.all([
      supabaseRest<LoreRow[]>(`tobyswap_lore_tokens?${query.toString()}`),
      loadCollectionFrequency(),
    ]);

    const row = rows[0];
    if (!row?.metadata || row.revealed !== true) {
      return NextResponse.json({ error: "Canonical metadata is not cached for this deed." }, { status: 404 });
    }

    const denominator = frequency.total === EXPECTED_TOTAL ? EXPECTED_TOTAL : frequency.total;
    const traits = extractLoreTraits(row.metadata).map((trait) => {
      const count = frequency.counts[traitKey(trait.trait_type, trait.value)] || 0;
      return {
        traitType: trait.trait_type,
        value: trait.value,
        count,
        total: denominator,
        percentage: denominator > 0 ? (count / denominator) * 100 : null,
      };
    });

    return NextResponse.json(
      {
        tokenId: tokenIdText,
        total: denominator,
        completeCollection: frequency.total === EXPECTED_TOTAL,
        traits,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: String(error?.message || "Rarity lookup failed.").slice(0, 180) },
      { status: 502 },
    );
  }
}
