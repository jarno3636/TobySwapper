export function normalizeKeeperHandle(value: unknown, max = 32) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^@+/, "").slice(0, max);
}

export function keeperProfileMessage(input: {
  tokenId: number;
  signer: string;
  xHandle: string;
  telegramHandle: string;
  timestamp: number;
}) {
  return [
    "Keeper of Toby · Community Profile",
    "",
    `Keeper: #${String(input.tokenId).padStart(3, "0")}`,
    `Wallet: ${input.signer.toLowerCase()}`,
    `X: ${input.xHandle || "(none)"}`,
    `Telegram: ${input.telegramHandle || "(none)"}`,
    `Timestamp: ${input.timestamp}`,
    "",
    "Signing updates only this Keeper's community handles. It cannot move, sell, approve, or alter the soulbound NFT.",
  ].join("\n");
}
