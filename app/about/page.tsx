// app/about/page.tsx
import NextDynamic from "next/dynamic";

// Render the heavy client component only on the client
const AboutClient = NextDynamic(() => import("./AboutClient"), { ssr: false });

// Avoid prerendering / idb / wagmi SSR issues
export const revalidate = 0;
export const dynamic = "force-dynamic";

export default function Page() {
  return <AboutClient />;
}
