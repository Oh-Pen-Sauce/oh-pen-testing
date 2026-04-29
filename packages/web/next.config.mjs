// Plain ESM, no TypeScript. Lets `next start` boot in the published
// tarball without Next auto-installing typescript at runtime (which it
// does to load .ts configs, and which fails on machines without pnpm /
// in environments where unattended package-install is wrong).
//
// Type-safety is preserved via the JSDoc type annotation below — the
// IDE and `tsc --noEmit` still validate the shape against NextConfig.

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  // pdfkit is a dynamic-import tucked inside @oh-pen-testing/shared's
  // buildPdfReport. The web app never calls it, but Turbopack still
  // scans the bundle. Marking it external keeps the build from chasing
  // native deps.
  serverExternalPackages: ["keytar", "pdfkit"],
  experimental: {
    serverActions: {
      allowedOrigins: ["127.0.0.1:7676", "localhost:7676"],
    },
  },
};

export default config;
