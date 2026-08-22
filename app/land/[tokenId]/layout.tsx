import type { Metadata } from "next";
import { getLoreAtlasIndex } from "@/lib/lore-atlas-server";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";

export async function generateMetadata({ params }: { params: { tokenId: string } }): Promise<Metadata> {
  const tokenId = String(params?.tokenId || "").trim();
  const fallbackTitle = `Lore Land #${tokenId} · Tobyworld`;
  const ogImage = `${SITE}/api/og/land/${encodeURIComponent(tokenId)}`;

  try {
    const index = await getLoreAtlasIndex();
    const land = index.byId[tokenId];
    if (!land) {
      return {
        title: fallbackTitle,
        description: "Explore a canonical Lore Land in the Tobyworld community Atlas.",
        openGraph: { title: fallbackTitle, images: [ogImage] },
        twitter: { card: "summary_large_image", title: fallbackTitle, images: [ogImage] },
      };
    }

    const name = land.communityName || `Lore Land #${tokenId}`;
    const signs = land.traits.slice(0, 3).map((trait) => trait.value).join(" · ");
    const description = land.keeperStory
      ? `${land.keeperStory.slice(0, 135)}${land.keeperStory.length > 135 ? "…" : ""}`
      : signs
        ? `${signs}. Explore this canonical Lore Land in Tobyworld.`
        : "Explore this canonical Lore Land in Tobyworld.";
    const title = `${name} · Tobyworld`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        url: `${SITE}/land/${tokenId}`,
        images: [{ url: ogImage, width: 1200, height: 630, alt: `${name} · Lore Land #${tokenId}` }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImage],
      },
    };
  } catch {
    return {
      title: fallbackTitle,
      description: "Explore a canonical Lore Land in Tobyworld.",
      openGraph: { title: fallbackTitle, images: [ogImage] },
      twitter: { card: "summary_large_image", title: fallbackTitle, images: [ogImage] },
    };
  }
}

export default function LandLayout({ children }: { children: React.ReactNode }) {
  return children;
}
