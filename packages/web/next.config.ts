import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // pdfkit is a dynamic-import tucked inside @oh-pen-testing/shared's
  // buildPdfReport. The web app never calls it, but Turbopack still scans
  // the bundle. Marking it external keeps the build from chasing native deps.
  serverExternalPackages: ["keytar", "pdfkit"],
  experimental: {
    serverActions: {
      allowedOrigins: ["127.0.0.1:7676", "localhost:7676"],
    },
  },
};

export default config;
