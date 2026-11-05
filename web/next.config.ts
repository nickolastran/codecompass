import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Local repo zips go through a server action (default cap is 1 MB)
    serverActions: { bodySizeLimit: "100mb" },
  },
};

export default nextConfig;
