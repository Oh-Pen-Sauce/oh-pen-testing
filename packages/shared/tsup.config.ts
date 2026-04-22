import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/pdf-report.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node22",
  // pdfkit is only used at runtime by the CLI — keep it external so the
  // web build (which never imports ./pdf-report) never has to trace it.
  external: ["pdfkit"],
});
