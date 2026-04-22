import { defineConfig } from "tsup";
import fs from "node:fs";
import path from "node:path";

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
  // The setup-assistant loader reads markdown assets at runtime. Tsup
  // doesn't copy non-TS files to dist by default, so mirror the assets
  // tree (memory.md + skills/*.md) into dist/assets/ after build. The
  // loader looks for `./assets` relative to the compiled entry first.
  async onSuccess() {
    const srcRoot = path.resolve("src/setup-assistant/assets");
    const destRoot = path.resolve("dist/assets");
    if (!fs.existsSync(srcRoot)) return;
    fs.rmSync(destRoot, { recursive: true, force: true });
    fs.cpSync(srcRoot, destRoot, { recursive: true });
  },
});
