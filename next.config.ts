import type { NextConfig } from "next";

// Local demo build: API routes are proxied to the deployed site (which holds the server keys).
const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: "https://voice-coffee.vercel.app/api/:path*" }];
  },
};

export default nextConfig;
