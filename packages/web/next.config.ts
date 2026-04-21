import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["keytar"],
  experimental: {
    serverActions: {
      allowedOrigins: ["127.0.0.1:7676", "localhost:7676"],
    },
  },
};

export default config;
