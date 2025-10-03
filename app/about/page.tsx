import dynamic from "next/dynamic";

// Turn off SSR for the heavy client-only page
const AboutClient = dynamic(() => import("./AboutClient"), { ssr: false });

export const revalidate = 0; // avoid static export trying to pre-render
export const dynamic = "force-dynamic";

export default function Page() {
  return <AboutClient />;
}
