import type { NextConfig } from "next";

const apiProxyTarget = process.env.API_PROXY_TARGET?.trim() || "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  // Standalone output traces only production-necessary files → smaller Docker image
  output: "standalone",
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.0.106", "192.168.56.1"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
