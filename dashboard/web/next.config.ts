import type { NextConfig } from "next";

const API = process.env.API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // Next dev blocks /_next assets for hosts it does not know; `web` is the compose service name,
  // used when the api container's headless Chromium smoke-tests the UI.
  allowedDevOrigins: ["web", "web:3000", "localhost", "127.0.0.1"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API}/:path*` }];
  },
  async redirects() {
    return [
      { source: "/runs", destination: "/system?tab=runs", permanent: false },
      { source: "/settings", destination: "/system", permanent: false },
    ];
  },
};

export default nextConfig;
