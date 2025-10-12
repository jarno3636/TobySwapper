import { NextResponse } from "next/server";

export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://tobyswap.vercel.app";

  return NextResponse.json(
    {
      version: "next",
      title: "Toby Swapper 🔥",
      image: `${site}/api/frame/image`,
      imageAlt: "Swap. Burn. Spread the Lore.",
      buttons: [
        { label: "Spread the Lore",   action: "post" },                // -> POST builds live copy + links
        { label: "Share to X",        action: "post" },                // -> POST builds live copy + links
        { label: "Open Toby Swapper", action: { type: "launch_url", url: site } },
        { label: "More 🔥",           action: "post" },
      ],
      postUrl: `${site}/api/frame/post`,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
