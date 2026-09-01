import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable experimental features that cause build issues
  experimental: {
    // Keep turbopack only for dev mode
  },
};

export default nextConfig;
