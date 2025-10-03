// app/about/page.tsx

import NextDynamic from "next/dynamic";

// Turn off SSR for the heavy client-only page
const AboutClient = NextDynamic(() => import("./AboutClient"), { ssr: false });

// Route options: avoid prerender & force dynamic
export const revalidate = 0;
export const dynamic = "force-dynamic";

export default function Page() {
  return <AboutClient />;
}
