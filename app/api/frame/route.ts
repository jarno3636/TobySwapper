import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    version: "next",
    image: `${process.env.NEXT_PUBLIC_SITE_URL}/api/frame/image`,
    buttons: [
      { label: "Open Toby Swapper", action: { type: "launch_url", url: `${process.env.NEXT_PUBLIC_SITE_URL}` } },
    ],
    postUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/frame/post`
  });
}
