// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // helpful for RainbowKit/Wagmi ESM packages
  experimental: {
    esmExternals: "loose", // safer than true on Vercel builders
  },

  // eliminate RN + wallet SDK + pino warnings in web builds
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),

      // MetaMask SDK (via wagmi) expects RN async storage – stub for web
      "@react-native-async-storage/async-storage": false,

      // pino / walletconnect noise
      "pino-pretty": false,
      "sonic-boom": false,
    };

    return config;
  },

  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
