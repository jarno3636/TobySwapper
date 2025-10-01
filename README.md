run)
// ─────────────────────────────────────────────────────────────────────────────
# Toby Swapper (Base)

- Dark glass + pill theme with color pips
- Wagmi + RainbowKit on Base
- Uses your verified Swapper at `0x6da391f470a00a206dded0f5fc0f144cae776d7c`
- 1% fee converted to TOBY and burned (handled by contract)

## Setup

```bash
pnpm i # or npm i
cp .env.example .env.local
npm run dev
```

## Notes
- SwapForm uses zero slippage placeholders. For production, fetch quotes from a router or price API and set minOut values.
- For token approvals (when tokenIn != ETH), wire an allowance flow (not included in the minimal demo to keep focus on contract calls).
- Frame endpoints are minimal; upgrade to Frames v2 spec with Neynar for production.
