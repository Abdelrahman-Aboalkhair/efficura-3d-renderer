import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow embedding in Framer (or any parent origin) via iframe
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Allow embedding from Framer, localhost, or any host
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *;",
          },
        ],
      },
    ];
  },
  // Smaller client bundles for the iframe use-case
  reactStrictMode: true,
};

export default nextConfig;
