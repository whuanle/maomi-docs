import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/docs/:path*",
        destination: "/api/docs/:path*",
      },
    ];
  },
};

export default nextConfig;
