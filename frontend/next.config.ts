import type { NextConfig } from "next";

const config: NextConfig = {
  // A final turn may include STT, summary/plan repair calls, and TTS.
  experimental: { proxyTimeout: 900_000 },
  async rewrites() {
    return [{ source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" }];
  },
};

export default config;
