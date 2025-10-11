// components/debugTypes.ts
import type { Address } from "viem";

export type QuoteAttempt =
  | {
      kind: "v3";
      pathTokens: Address[];
      fees: number[];          // uint24s parallel to hops
      ok: boolean;
      amountOut?: bigint;
      ms: number;
      error?: string;
    }
  | {
      kind: "v2";
      pathTokens: Address[];
      ok: boolean;
      amountOut?: bigint;
      ms: number;
      error?: string;
    };

export type PreflightInfo = {
  allowance?: bigint;
  needApproval?: boolean;
  inBalance?: bigint;
  outBalance?: bigint;
  minOut?: string;
  deadline?: bigint;
};

export type TxInfo = {
  stage: "idle" | "simulating" | "sending" | "mined" | "error";
  msg?: string;
  hash?: `0x${string}`;
};

export type DebugInfo = {
  // Environment
  isOnBase: boolean;
  chainId?: number;
  account?: Address;

  // Inputs
  tokenIn?: Address | "ETH";
  tokenOut?: Address;
  amountInHuman?: string;
  slippage?: number;
  feeBps?: bigint;

  // Quoting
  state: "idle" | "loading" | "ok" | "noroute";
  bestKind?: "v3" | "v2";
  bestOut?: bigint;
  attempts: QuoteAttempt[];
  quoteError?: string;

  // Preflight/tx
  preflight?: PreflightInfo;
  tx?: TxInfo;

  // Addresses/constants (handy to eyeball)
  addresses?: {
    SWAPPER?: Address;
    QUOTER_V3?: Address;
    QUOTE_ROUTER_V2?: Address;
    WETH?: Address;
    USDC?: Address;
    TOBY?: Address;
  };
};
