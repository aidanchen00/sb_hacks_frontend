import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile Solana packages to fix ESM import issues
  transpilePackages: [
    "@solana/web3.js",
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-phantom",
    "@noble/curves",
    "@noble/hashes",
  ],
  
  // Configure Turbopack (Next.js 16 default)
  turbopack: {
    resolveAlias: {
      // Fix for crypto polyfills in browser
      crypto: "crypto-browserify",
    },
  },
};

export default nextConfig;
