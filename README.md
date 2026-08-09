# Toby Swapper

Tobyworld-styled Base swap interface for ETH, USDC, TOBY, PATIENCE and TABOSHI using the deployed TobySwapper contract.

## Production setup

1. Copy `.env.example` to your deployment environment.
2. Set `NEXT_PUBLIC_SITE_URL` to the canonical deployed HTTPS domain.
3. Set `BASE_RPC_URL` to a reliable private Base mainnet RPC. The app's `/api/rpc` route rotates through that provider, Alchemy (when configured), and public Base RPC fallbacks.
4. Set `ALCHEMY_API_KEY` for server-side token pricing and an additional RPC fallback.
5. Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` for WalletConnect/RainbowKit support.
6. Deploy, then verify `/.well-known/farcaster.json`, `/site.webmanifest`, `/api/rpc`, and `/api/prices` from the public domain.

## Compatibility

- Farcaster: uses the Farcaster Mini App connector, `ready()`, Mini App embed metadata, and the Farcaster manifest.
- Standard web/dapp: uses wagmi/viem + injected wallets, Coinbase Wallet, MetaMask, Rainbow, Rabby, and WalletConnect.
- Base App: the app remains a standard web dapp and uses normal EVM wallet connectivity. Register/maintain the production URL in Base's current app/developer flow separately from this source code.

## Routes and pricing

The quote engine searches supported V2 and V3 paths, including WETH, USDC and TOBY hubs. TABOSHI is enabled and can use its V3 liquidity for the main trade while the TobySwapper contract's fee path remains routed through supported V2 liquidity for the TOBY burn.

Price display is informational only. `/api/prices` prefers Alchemy's token-price API and falls back to the highest-liquidity Base pair returned by Dexscreener. Swap execution uses onchain router quotes rather than USD display prices.
