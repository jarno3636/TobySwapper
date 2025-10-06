// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // helpful for RainbowKit/Wagmi ESM packages
  experimental: {
    esmExternals: "loose", // safer than true on Vercel builders
  },

  // eliminate walletconnect / pino warnings
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "pino-pretty": false,
      "sonic-boom": false,
    };
    return config;
  },

  images: {
    // enables static image optimization in Next 14
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
