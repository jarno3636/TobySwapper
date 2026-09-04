import type { Address } from "viem";

/**
 * Canonical holder roles used by the homepage reserve dashboard.
 * Lowercase addresses avoid mixed-case checksum drift while preserving the
 * exact same Base accounts.
 */
export const PATIENCE_FEE_TREASURY = "0xbb0e97108dabe7fbf743537a38ce064d03978e75" as Address;
export const LORE_ACTIVATION_VAULT = "0xd49c3f0dd67378be76a1142dfb9a5107f99a34dd" as Address;
export const POND_LORE_RESERVE = "0x7dcf7e9394438ce5e0370b27108c276e6ea6e592" as Address;
export const LORE_RESERVE_CUSTODY = "0x0c3178c9145a3ddd378587523605a39fe585c423" as Address;
export const LORE_ACTIVATION_MANAGER = "0xdaf88bf803765882a674bc9b2bce20d47a7250f2" as Address;
export const POND_FEE_ROUTER = "0x12832e743f7f0d7fc90e55ad2df11617b5359305" as Address;
export const LORE_REWARD_DISTRIBUTOR = "0x01d704eb4d3ecc53e5b4a320879715ca6fece18d" as Address;
export const SAT0_REVENUE_ROUTER = "0x0332f29a1bbd4c9793e769d263adcc79770973e7" as Address;
export const SAT0_REGISTRY = "0x02d734aa97056a9dcbac393be861af7a6e16b0d2" as Address;
export const TOBYWORLD_GOVERNANCE_SAFE = "0x136f78d97372976cbae65c1ed8d86dae9cc8ad58" as Address;
export const POND_REFILL_CONTROLLER = "0xee3ea11dba58bba46e23f9776ae4a66bd30efe93" as Address;
export const POND_REFILL_SCHEDULER = "0x7b3d61be178d5e7ab6677bc311898bd010ba92b2" as Address;
export const SAT0_TIMELOCK = "0x647fcc6fb2f6e4128953b85282c9e6a5898bee19" as Address;

export const RESERVE_VAULT_ABI = [
  { type: "function", name: "balance", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalActuallyReceived", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalActivationsCollected", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export const RESERVE_MANAGER_ABI = [
  { type: "function", name: "totalLockedX", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalActivations", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export const POND_FEE_ROUTER_ABI = [
  { type: "function", name: "routingEnabled", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "unallocatedProtocolETH", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "pendingMemberETH", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "operationsETH", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "safetyETH", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalETHFeesRecorded", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalMemberETHDrawn", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "memberBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "operationsBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "safetyBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "operationsRecipient", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "safetyRecipient", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

export const LORE_REWARD_DISTRIBUTOR_ABI = [
  { type: "function", name: "registeredAssets", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] },
  {
    type: "function",
    name: "assetAccounting",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [{
      name: "",
      type: "tuple",
      components: [
        { name: "registered", type: "bool" },
        { name: "enabled", type: "bool" },
        { name: "totalFunded", type: "uint256" },
        { name: "reserved", type: "uint256" },
        { name: "undistributed", type: "uint256" },
        { name: "totalDistributed", type: "uint256" },
      ],
    }],
  },
  { type: "function", name: "assetSolvent", stateMutability: "view", inputs: [{ name: "asset", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allAssetsSolvent", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
] as const;

export const SYSTEM_ROLES = [
  {
    title: "SAT0 Revenue Router",
    address: SAT0_REVENUE_ROUTER,
    note: "Temporary quote-asset routing. Excluded until the canonical Treasury and Trader Rewards destinations are resolved.",
  },
  {
    title: "SAT0 Market Registry",
    address: SAT0_REGISTRY,
    note: "Market-system state, not treasury value.",
  },
  {
    title: "Pond Refill Controller",
    address: POND_REFILL_CONTROLLER,
    note: "Operational controller, not treasury value.",
  },
  {
    title: "Pond Refill Scheduler",
    address: POND_REFILL_SCHEDULER,
    note: "Operational scheduler, not treasury value.",
  },
  {
    title: "SAT0 Governance / Timelock",
    address: SAT0_TIMELOCK,
    note: "Governance infrastructure, not spendable reserves.",
  },
] as const;

export const reserveBaseScan = (address: Address) => `https://basescan.org/address/${address}` as const;
