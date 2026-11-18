import type { NextConfig } from "next";
import path from "path";

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=self, microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  turbopack: {
    root: path.join(__dirname),
  },
  async rewrites() {
    return [
      { source: "/login-ui", destination: "/login-ui/index.html" },
      { source: "/login-ui/:screen([^.]*)", destination: "/login-ui/index.html" },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/login-ui/:path*",
        headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" }],
      },
    ];
  },
};

export default nextConfig;
