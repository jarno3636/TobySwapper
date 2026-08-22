import { ImageResponse } from "next/og";
import { getLoreAtlasIndex } from "@/lib/lore-atlas-server";

export const runtime = "nodejs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(_request: Request, { params }: { params: { tokenId: string } }) {
  const tokenId = clean(params?.tokenId);

  try {
    const index = await getLoreAtlasIndex();
    const land = index.byId[tokenId];

    if (!land) {
      return new ImageResponse(
        (
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 72, background: "#0b2628", color: "#eef8f4", fontFamily: "sans-serif" }}>
            <div style={{ fontSize: 28, letterSpacing: 7, color: "#7ec8b2", fontWeight: 700 }}>TOBYWORLD</div>
            <div style={{ marginTop: 24, fontSize: 70, fontWeight: 800 }}>Lore Land stayed behind the veil.</div>
          </div>
        ),
        { width: 1200, height: 630 },
      );
    }

    const placeName = land.communityName || `Lore Land #${tokenId}`;
    const signs = land.traits.slice(0, 4);
    const keeper = land.keeperName || land.keeperSocial || "Unmarked Keeper";
    const imageUrl = land.imageUrl && /^https?:\/\//i.test(land.imageUrl) ? land.imageUrl : `${SITE}/og/tobyswap-card-1200x630.png`;

    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", padding: 42, background: "linear-gradient(135deg,#071f21 0%,#103335 54%,#0b2527 100%)", color: "#eef8f4", fontFamily: "sans-serif" }}>
          <div style={{ width: 530, height: 546, borderRadius: 34, overflow: "hidden", border: "2px solid rgba(177,224,207,.35)", background: "#15383a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={imageUrl} width="530" height="546" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px 18px 14px 52px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 23, letterSpacing: 6, color: "#7fcbb4", fontWeight: 800 }}>TOBYWORLD · LORE LAND</div>
              <div style={{ fontSize: 27, color: "#d5eee5", border: "1px solid rgba(185,225,211,.28)", borderRadius: 999, padding: "10px 18px" }}>#{tokenId}</div>
            </div>

            <div style={{ marginTop: 34, fontSize: placeName.length > 28 ? 52 : 62, lineHeight: 1.02, fontWeight: 800, letterSpacing: -2 }}>{placeName}</div>
            <div style={{ marginTop: 22, fontSize: 24, color: "#a8c3bb" }}>Keeper · {keeper}</div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 38 }}>
              {signs.map((sign) => (
                <div key={`${sign.traitType}-${sign.value}`} style={{ display: "flex", flexDirection: "column", padding: "12px 16px", borderRadius: 18, border: "1px solid rgba(139,206,185,.18)", background: "rgba(23,61,61,.78)" }}>
                  <div style={{ fontSize: 13, letterSpacing: 3, color: "#6fa695", fontWeight: 700 }}>{sign.traitType.toUpperCase()}</div>
                  <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, color: "#eff9f5" }}>{sign.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", color: "#85a79d", fontSize: 20 }}>
              <span>Canonical signs · Keeper-written story</span>
              <span style={{ color: "#8bd5bb", fontWeight: 700 }}>Explore this land →</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
      },
    );
  } catch {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b2628", color: "#eef8f4", fontSize: 64, fontFamily: "sans-serif" }}>Lore Land #{tokenId}</div>,
      { width: 1200, height: 630 },
    );
  }
}
