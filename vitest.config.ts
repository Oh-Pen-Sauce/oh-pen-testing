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
  },
});
