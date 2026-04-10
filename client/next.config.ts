import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow cross-origin requests to the local API server during development
  async rewrites() {
    return [];
  },
};

export default nextConfig;
