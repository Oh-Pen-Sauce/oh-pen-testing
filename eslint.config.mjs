// Flat ESLint config for the Oh Pen Testing monorepo.
//
// Pragmatic by design: the recommended rule sets catch real mistakes,
// but the high-volume stylistic rules are downgraded to warnings so the
// gate passes on the existing 33k-line codebase today. The intent is a
// real, non-zero lint gate now (errors fail CI, `pnpm lint`), then
// ratchet rules from warn to error as the code is cleaned up.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/*.config.*",
      // Generated type declarations (e.g. Next's next-env.d.ts, which
      // uses a triple-slash reference we cannot rewrite).
      "**/*.d.ts",
      // Intentionally-vulnerable fixtures: linting them is noise.
      "playbooks/**/tests/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // TypeScript's own checker covers undefined-symbol detection, and
      // it understands node/browser/JSX globals without an env list.
      "no-undef": "off",
      // High-volume in this codebase; keep them as signal, not a gate,
      // until they are cleaned up. Underscore-prefixed args/vars are
      // intentional throwaways.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
  {
    // React hooks linting for the web package. rules-of-hooks is a real
    // bug class (error); exhaustive-deps stays a warning (the wizard has
    // a few deliberate, commented exceptions).
    files: ["packages/web/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);
