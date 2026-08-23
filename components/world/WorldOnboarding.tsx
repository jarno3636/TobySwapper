"use client";

import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import { base } from "wagmi/chains";
import { LORE_COLLECTION_ADDRESS, LORE_DEEDS_ABI } from "@/lib/lore-deeds";
import { TABOSHI_SEEDS_ADDRESS, TABOSHI_SEEDS_ABI, TABOSHI_SEED_ID } from "@/lib/taboshi-seeds";
import TobyworldIcon from "@/components/TobyworldIcon";

const quietRead = {
  staleTime: Infinity,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export default function WorldOnboarding() {
  const { address, isConnected } = useAccount();
  const landRead = useReadContract({
    address: LORE_COLLECTION_ADDRESS,
    abi: LORE_DEEDS_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: base.id,
    query: { ...quietRead, enabled: Boolean(address) },
  });
  const seedRead = useReadContract({
    address: TABOSHI_SEEDS_ADDRESS,
    abi: TABOSHI_SEEDS_ABI,
    functionName: "balanceOf",
    args: address ? [address, TABOSHI_SEED_ID] : undefined,
    chainId: base.id,
    query: { ...quietRead, enabled: Boolean(address) },
  });

  const landCount = typeof landRead.data === "bigint" ? landRead.data : 0n;
  const seedCount = typeof seedRead.data === "bigint" ? seedRead.data : 0n;
  const ownsLand = landCount > 0n;

  return (
    <section className={`world-onboarding world-onboarding-refined ${ownsLand ? "has-land" : ""}`}>
      <div className="world-onboarding-intro">
        <div className="world-onboarding-frog world-onboarding-lore"><TobyworldIcon kind="lore" size={72} /></div>
        <div>
          <span className="land-section-kicker">FIND YOUR PLACE</span>
          <h2>{!isConnected ? "The World is open before you connect." : ownsLand ? `Your ${landCount === 1n ? "land is" : "lands are"} waiting.` : "There is more than one way into Tobyworld."}</h2>
          <p>{!isConnected ? "Wander the Atlas, study canonical signs and meet the keepers first. Connect only when you want to see your own land and pouch." : ownsLand ? `You carry ${landCount.toLocaleString()} Lore ${landCount === 1n ? "Deed" : "Deeds"}. Open My Tobyworld to visit your places, tend your Keeper Mark and manage what each deed carries.` : seedCount > 0n ? `You already carry ${seedCount.toLocaleString()} SEED. Explore the World, meet its keepers, or look for a deed when the path feels right.` : "Explore lands, meet their keepers or look for a deed. No single path is required."}</p>
        </div>
      </div>

      <div className="world-onboarding-paths world-onboarding-paths-refined">
        {ownsLand ? (
          <>
            <Link prefetch={false} href="/taboshi1#land" className="world-path-card is-land"><TobyworldIcon kind="pouch" size={38} /><strong>My Tobyworld</strong><small>Visit land · pouch · Keeper Mark</small><b>→</b></Link>
            <a href="#atlas" className="world-path-card is-explore"><TobyworldIcon kind="lore" size={38} /><strong>Explore the Atlas</strong><small>All 2,869 canonical lands</small><b>↓</b></a>
            <Link prefetch={false} href="/keepers" className="world-path-card is-keepers"><TobyworldIcon kind="toby" size={38} /><strong>Meet the Keepers</strong><small>Identity · stories · legacy</small><b>→</b></Link>
          </>
        ) : (
          <>
            <a href="#atlas" className="world-path-card is-explore"><TobyworldIcon kind="lore" size={38} /><strong>Explore the Atlas</strong><small>All 2,869 canonical lands</small><b>↓</b></a>
            <Link prefetch={false} href="/keepers" className="world-path-card is-keepers"><TobyworldIcon kind="toby" size={38} /><strong>Meet the Keepers</strong><small>Community identity & land legacy</small><b>→</b></Link>
            <Link prefetch={false} href="/world/exchange" className="world-path-card is-market"><TobyworldIcon kind="lore" size={38} /><strong>Find a Lore Deed</strong><small>Listings & buy requests</small><b>→</b></Link>
          </>
        )}
      </div>

      {!ownsLand ? (
        <div className="world-onboarding-quiet-links" aria-label="More ways into Tobyworld">
          <a href="https://tobyworld.app/faucet/" target="_blank" rel="noreferrer"><span className="world-path-seed"><TobyworldIcon kind="seed" size={32} /></span><b>{seedCount > 0n ? "Visit the Faucet" : "Find SEED"}</b><small>Official Tobyworld path ↗</small></a>
          <Link prefetch={false} href="/#swap"><span className="world-path-patience"><TobyworldIcon kind="patience" size={32} /></span><b>Pond Utility</b><small>Swap when you need it →</small></Link>
        </div>
      ) : null}
    </section>
  );
}
