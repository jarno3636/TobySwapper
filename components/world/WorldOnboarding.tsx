"use client";

import Link from "next/link";
import Image from "next/image";
import { useAccount, useReadContract } from "wagmi";
import { base } from "wagmi/chains";
import { LORE_COLLECTION_ADDRESS, LORE_DEEDS_ABI } from "@/lib/lore-deeds";
import { TABOSHI_SEEDS_ADDRESS, TABOSHI_SEEDS_ABI, TABOSHI_SEED_ID } from "@/lib/taboshi-seeds";

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
    <section className={`world-onboarding ${ownsLand ? "has-land" : ""}`}>
      <div className="world-onboarding-intro">
        <div className="world-onboarding-frog world-onboarding-patience"><Image src="/tokens/patience.PNG" alt="PATIENCE" fill sizes="72px" className="object-contain" /></div>
        <div>
          <span className="land-section-kicker">FIND YOUR PLACE</span>
          <h2>{!isConnected ? "The World is open before you connect." : ownsLand ? `Your ${landCount === 1n ? "land is" : "lands are"} waiting.` : "There is more than one way into Tobyworld."}</h2>
          <p>{!isConnected ? "Wander the Atlas, study canonical signs and meet the keepers first. Connect only when you want to see your own pouch and land." : ownsLand ? `You carry ${landCount.toLocaleString()} Lore ${landCount === 1n ? "Deed" : "Deeds"}. Open My Tobyworld to visit your places and write your Keeper Mark.` : seedCount > 0n ? `You already carry ${seedCount.toLocaleString()} SEED. Explore the World, meet its keepers, or use the pond utility when you need it.` : "Explore lands, meet their keepers, visit the Faucet, or look for a deed. No single path is required."}</p>
        </div>
      </div>

      <div className="world-onboarding-paths">
        <a href="#atlas" className="world-path-card is-explore"><span>◎</span><strong>Explore the World</strong><small>All 2,869 canonical lands</small><b>↓</b></a>
        <Link prefetch={false} href="/keepers" className="world-path-card is-keepers"><span>◌</span><strong>Meet the Keepers</strong><small>Community identity & land legacy</small><b>→</b></Link>
        {!ownsLand && <Link prefetch={false} href="/world/exchange" className="world-path-card is-market"><span>△</span><strong>Find a Lore Deed</strong><small>Browse listings or leave a buy request</small><b>→</b></Link>}
        {!ownsLand && <a href="https://tobyworld.app/faucet/" target="_blank" rel="noreferrer" className="world-path-card is-seed"><span className="world-path-seed"><Image src="/ui/seed.webp" alt="" fill sizes="44px" className="object-cover" /></span><strong>{seedCount > 0n ? "Visit the Faucet" : "Find SEED"}</strong><small>{seedCount > 0n ? "The faucet may not flow forever" : "An official Tobyworld path"}</small><b>↗</b></a>}
        {!ownsLand && <Link prefetch={false} href="/#swap" className="world-path-card is-pond"><span className="world-path-patience"><Image src="/tokens/patience.PNG" alt="" fill sizes="44px" className="object-contain" /></span><strong>Pond Utility</strong><small>TOBY · PATIENCE · TABOSHI swaps</small><b>→</b></Link>}
        {ownsLand && <Link prefetch={false} href="/taboshi1#land" className="world-path-card is-land"><span>△</span><strong>My Tobyworld</strong><small>Visit land · manage pouch · Keeper Mark</small><b>→</b></Link>}
      </div>
    </section>
  );
}
