import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["@react-three/drei"],
  },
  async rewrites() {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
    return [{ source: "/runtime-assets/:path*", destination: `${apiBaseUrl}/api/assets/:path*` }];
  },
};

export default nextConfig;
