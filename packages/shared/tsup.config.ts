import { defineConfig } from "tsup";
import fs from "node:fs";
import path from "node:path";

export default defineConfig({
  entry: ["src/index.ts", "src/pdf-report.ts", "src/model-catalog.ts"],
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
    // Mirror the setup-assistant bundle (memory.md + skills/*.md) into
    // dist/assets/ — the setup loader walks candidate paths including
    // ./assets relative to the compiled entry.
    const setupSrc = path.resolve("src/setup-assistant/assets");
    const setupDest = path.resolve("dist/assets");
    if (fs.existsSync(setupSrc)) {
      fs.rmSync(setupDest, { recursive: true, force: true });
      fs.cpSync(setupSrc, setupDest, { recursive: true });
    }
    // Same trick for the agent profiles (memory.md + playbooks.yml per
    // agent). The agent loader looks for ./agents-assets next to the
    // compiled entry, falling back to source paths in dev.
    const agentsSrc = path.resolve("src/agents/assets");
    const agentsDest = path.resolve("dist/agents-assets");
    if (fs.existsSync(agentsSrc)) {
      fs.rmSync(agentsDest, { recursive: true, force: true });
      fs.cpSync(agentsSrc, agentsDest, { recursive: true });
    }
  },
});
