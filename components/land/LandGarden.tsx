"use client";

import Image from "next/image";

export type GardenStage = {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  copy: string;
};

export function gardenStageFromSeeds(seedBalance: bigint): GardenStage {
  if (seedBalance >= 1_000_000n) return { level: 4, label: "Lush garden", copy: "A dense garden has taken shape around this deed." };
  if (seedBalance >= 111_110n) return { level: 3, label: "Growing garden", copy: "The land is visibly taking root." };
  if (seedBalance >= 11_111n) return { level: 2, label: "First seedlings", copy: "Seedlings have started to break through the soil." };
  if (seedBalance > 0n) return { level: 1, label: "A seed stirs", copy: "Something is carried here, but the garden is still young." };
  return { level: 0, label: "Quiet soil", copy: "No SEED is carried by this land keeper yet." };
}

export default function LandGarden({ seedBalance }: { seedBalance: bigint }) {
  const stage = gardenStageFromSeeds(seedBalance);
  return (
    <section className={`land-module land-garden-module land-garden-stage-${stage.level}`}>
      <div className="land-module-head">
        <div><span className="land-section-kicker">CULTIVATION</span><h2>Your garden</h2></div>
        <span className="land-seed-count"><Image src="/seed.png" alt="" width={26} height={26} />{seedBalance.toLocaleString()} SEED</span>
      </div>

      <div className="land-scene" aria-label={`Visual cultivation stage: ${stage.label}`}>
        <span className="land-moon" />
        <span className="land-cloud c1" /><span className="land-cloud c2" />
        <span className="land-island-base" />
        <span className="land-waterline" />
        <span className="land-tree t1" /><span className="land-tree t2" /><span className="land-tree t3" />
        <span className="land-sprout p1" /><span className="land-sprout p2" /><span className="land-sprout p3" /><span className="land-sprout p4" /><span className="land-sprout p5" />
        <span className="land-scene-shine" />
      </div>

      <div className="land-garden-copy">
        <strong>{stage.label}</strong>
        <p>{stage.copy}</p>
        <small>A visual garden shaped by the SEED carried by this keeper.</small>
      </div>
      <div className="land-question"><span>?</span><div><b>What will grow here?</b><small>The pond has not revealed everything yet.</small></div></div>
    </section>
  );
}
