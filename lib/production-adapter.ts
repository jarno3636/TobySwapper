import type { Address } from "viem";

export type ProductionSnapshot = {
  rewardToken?: Address;
  pendingRewards?: bigint;
  claimedRewards?: bigint;
  claimable?: boolean;
  epoch?: bigint;
};

export interface LoreProductionAdapter {
  readonly id: string;
  readonly configured: boolean;
  read(tokenId: bigint, owner?: Address): Promise<ProductionSnapshot | null>;
  claim?(tokenId: bigint): Promise<`0x${string}`>;
}

/** No rewards contract has been configured. Intentionally inert. */
export const dormantProductionAdapter: LoreProductionAdapter = {
  id: "dormant",
  configured: false,
  async read() { return null; },
};
