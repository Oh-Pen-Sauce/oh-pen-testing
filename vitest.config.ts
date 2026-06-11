import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Use the automatic JSX runtime so .test.tsx files don't need an
  // explicit `import React`. The web package's tsconfig.json sets
  // jsx: "preserve" (Next handles JSX transforms in build), but
  // vitest goes through esbuild which defaults to classic.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    globals: true,
    environment: "node",
    root: here,
    include: [
      path.join(here, "packages/**/*.test.ts"),
      path.join(here, "packages/**/*.test.tsx"),
      path.join(here, "tests/**/*.test.ts"),
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "lcov"],
      reportsDirectory: path.join(here, "coverage"),
      // Floor thresholds: a ratchet that prevents regressions, set just
      // under the current all-files numbers. They are low because the
      // 16k-line Next web package and the CLI command layer are almost
      // entirely untested today; line/statement coverage is dominated
      // by that dead weight. Raise these as Phase 4 backfills tests
      // (providers, git-adapters, web server-actions). The point today
      // is that the gate exists and cannot silently regress to zero.
      thresholds: {
        statements: 7,
        branches: 50,
        functions: 30,
        lines: 7,
      },
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.next/**",
        "**/.turbo/**",
        "**/*.config.*",
        "**/*.test.*",
        "**/*.d.ts",
        "scripts/**",
        "playbooks/**",
      ],
    },
  },
});
