/**
 * Narrow verified frontend surface required by the Lore Land activation UI.
 * Economic values are always read from the manager at runtime.
 *
 * getLock is intentionally only described by its INPUT here. The hook performs
 * a raw eth_call and decodes the returned static words defensively. That keeps
 * this client from inventing a struct layout that was not supplied to it while
 * still using the deployed manager as the source of truth.
 */
export const activationManagerAbi = [
  { type: "function", name: "activationStarted", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "activationXAmount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "activationYCost", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "minActivationX", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "maxActivationX", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "minActivationY", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "maxActivationY", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "isActive", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "activeLockId", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getLock", stateMutability: "view", inputs: [{ name: "lockId", type: "uint256" }], outputs: [] },
  { type: "function", name: "totalActivations", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalLockedX", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "heldX", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "solvent", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "pausableOperations", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32[]" }] },
  { type: "function", name: "operationPaused", stateMutability: "view", inputs: [{ name: "operationId", type: "bytes32" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "activate", stateMutability: "nonpayable", inputs: [
    { name: "tokenId", type: "uint256" },
    { name: "maxYIn", type: "uint256" },
    { name: "expectedXAmount", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ], outputs: [] },
  { type: "function", name: "withdrawX", stateMutability: "nonpayable", inputs: [{ name: "lockId", type: "uint256" }], outputs: [] },

  { type: "error", name: "ActivationNotStarted", inputs: [] },
  { type: "error", name: "DeadlineExpired", inputs: [] },
  { type: "error", name: "NotNFTOwner", inputs: [] },
  { type: "error", name: "ProtocolCustodyCannotActivate", inputs: [] },
  { type: "error", name: "AlreadyActive", inputs: [] },
  { type: "error", name: "UnexpectedXRequirement", inputs: [] },
  { type: "error", name: "YSlippageExceeded", inputs: [] },
  { type: "error", name: "ShortXReceipt", inputs: [] },
  { type: "error", name: "StillLocked", inputs: [] },
] as const;

export const canonicalActivationNftAbi = [
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "transferNonce", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;
