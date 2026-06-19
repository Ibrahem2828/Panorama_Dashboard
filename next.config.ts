import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for optimized Docker images (Coolify friendly)
  output: "standalone",
};

export default nextConfig;
