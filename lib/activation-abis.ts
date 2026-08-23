/**
 * Exact user-facing surface of the deployed Canonical Lore
 * ActivationManager on Base.
 *
 * ActivationManager:
 * 0xDAf88BF803765882a674Bc9B2bCE20D47A7250F2
 */

export const activationManagerAbi = [
  {
    type: "function",
    name: "LOCK_DURATION",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "activationStarted",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "activationXAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "activationYCost",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "minActivationX",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "maxActivationX",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "minActivationY",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "maxActivationY",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isActive",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "activeLockId",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getLock",
    stateMutability: "view",
    inputs: [{ name: "lockId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          {
            name: "tokenId",
            type: "uint256",
          },
          {
            name: "locker",
            type: "address",
          },
          {
            name: "xAmount",
            type: "uint256",
          },
          {
            name: "startTime",
            type: "uint64",
          },
          {
            name: "unlockTime",
            type: "uint64",
          },
          {
            name: "ownershipNonceAtActivation",
            type: "uint256",
          },
          {
            name: "withdrawn",
            type: "bool",
          },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "totalActivations",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalLockedX",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "heldX",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "solvent",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "pausableOperations",
    stateMutability: "pure",
    inputs: [],
    outputs: [
      {
        name: "ops",
        type: "bytes32[]",
      },
    ],
  },
  {
    type: "function",
    name: "operationPaused",
    stateMutability: "view",
    inputs: [
      {
        name: "operation",
        type: "bytes32",
      },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "activate",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "tokenId",
        type: "uint256",
      },
      {
        name: "maxYIn",
        type: "uint256",
      },
      {
        name: "expectedXAmount",
        type: "uint256",
      },
      {
        name: "deadline",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "lockId",
        type: "uint256",
      },
    ],
  },
  {
    type: "function",
    name: "withdrawX",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "lockId",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "amount",
        type: "uint256",
      },
    ],
  },

  // Friendly transaction error decoding
  {
    type: "error",
    name: "ActivationNotStarted",
    inputs: [],
  },
  {
    type: "error",
    name: "DeadlineExpired",
    inputs: [
      { name: "deadline", type: "uint256" },
      { name: "nowTimestamp", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "NotNFTOwner",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "caller", type: "address" },
    ],
  },
  {
    type: "error",
    name: "ProtocolCustodyCannotActivate",
    inputs: [{ name: "caller", type: "address" }],
  },
  {
    type: "error",
    name: "AlreadyActive",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "lockId", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "UnexpectedXRequirement",
    inputs: [
      { name: "supplied", type: "uint256" },
      { name: "configured", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "YSlippageExceeded",
    inputs: [
      { name: "actualDebit", type: "uint256" },
      { name: "maxYIn", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ShortXReceipt",
    inputs: [
      { name: "required", type: "uint256" },
      { name: "received", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "StillLocked",
    inputs: [
      { name: "lockId", type: "uint256" },
      { name: "unlockTime", type: "uint64" },
    ],
  },
  {
    type: "error",
    name: "OperationIsPaused",
    inputs: [{ name: "operation", type: "bytes32" }],
  },
  {
    type: "error",
    name: "LockAlreadyWithdrawn",
    inputs: [{ name: "lockId", type: "uint256" }],
  },
  {
    type: "error",
    name: "LockNotFound",
    inputs: [{ name: "lockId", type: "uint256" }],
  },
  {
    type: "error",
    name: "NotLockOwner",
    inputs: [
      { name: "lockId", type: "uint256" },
      { name: "caller", type: "address" },
    ],
  },
  {
    type: "error",
    name: "VaultInsolvent",
    inputs: [
      { name: "held", type: "uint256" },
      { name: "owed", type: "uint256" },
    ],
  },
] as const;

export const canonicalActivationNftAbi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "transferNonce",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
