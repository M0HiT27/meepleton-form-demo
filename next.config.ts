import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // no headers() block for /api/:path* — CORS is now handled entirely in proxy.ts
};

export default nextConfig;