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
        <div className="world-onboarding-frog"><Image src="/tokens/toby.PNG" alt="Toby" fill sizes="72px" className="object-contain" /></div>
        <div>
          <span className="land-section-kicker">FIND YOUR PLACE</span>
          <h2>{!isConnected ? "A new frog enters the world." : ownsLand ? `Your ${landCount === 1n ? "land is" : "lands are"} waiting.` : "Every frog starts somewhere."}</h2>
          <p>{!isConnected ? "Explore first. Connect when you are ready to see what your wallet carries." : ownsLand ? `You carry ${landCount.toLocaleString()} Lore ${landCount === 1n ? "Deed" : "Deeds"}. Open My Tobyworld to see each deed number and visit your places.` : seedCount > 0n ? `You already carry ${seedCount.toLocaleString()} SEED. Wander the Atlas, study the canonical signs, or enter the pond.` : "Wander community lands, take a sip from the Faucet, or enter the pond. There is no required path."}</p>
        </div>
      </div>

      <div className="world-onboarding-paths">
        <a href="#atlas" className="world-path-card is-explore"><span>◌</span><strong>Explore the World</strong><small>Wander all 2,869 canonical lands</small><b>↓</b></a>
        {!ownsLand && <a href="https://tobyworld.app/faucet/" target="_blank" rel="noreferrer" className="world-path-card is-seed"><span className="world-path-seed"><Image src="/ui/seed.webp" alt="" fill sizes="44px" className="object-cover" /></span><strong>{seedCount > 0n ? "Visit the Faucet" : "Get SEED"}</strong><small>{seedCount > 0n ? "The faucet may not flow forever" : "A beginning for new frogs"}</small><b>↗</b></a>}
        {!ownsLand && <Link prefetch={false} href="/world/exchange" className="world-path-card is-market"><span>△</span><strong>Find a Lore Deed</strong><small>Browse listings or leave a buy request</small><b>→</b></Link>}
        {!ownsLand && <Link prefetch={false} href="/#swap" className="world-path-card is-pond"><span>⇄</span><strong>Enter the Pond</strong><small>TOBY · PATIENCE · TABOSHI</small><b>→</b></Link>}
        {ownsLand && <Link prefetch={false} href="/taboshi1#land" className="world-path-card is-land"><span>△</span><strong>My Land</strong><small>See deed IDs and visit your places</small><b>→</b></Link>}
      </div>
    </section>
  );
}
