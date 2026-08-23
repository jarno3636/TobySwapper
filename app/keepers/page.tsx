import Link from "next/link";
import MiniAppGate from "@/components/MiniAppGate";
import Footer from "@/components/Footer";
import PondDock from "@/components/PondDock";
import KeeperDirectory from "@/components/world/KeeperDirectory";
import { getKeeperDirectoryFresh } from "@/lib/keeper-directory-server";

export const dynamic = "force-dynamic";

export default async function KeepersPage() {
  const keepers = await getKeeperDirectoryFresh().catch((error) => {
    console.error("[keepers/page] Initial Keeper load failed:", error);
    return [];
  });

  return (
    <MiniAppGate>
      <main className="keeper-page mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
        <header className="world-topbar">
          <Link prefetch={false} href="/world">
            ← World Atlas
          </Link>
          <span>TOBYWORLD · KEEPERS</span>
        </header>

        <KeeperDirectory keepers={keepers} />
      </main>

      <Footer />
      <PondDock active="world" />
    </MiniAppGate>
  );
}
