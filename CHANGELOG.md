# Changelog

All notable changes to Oh Pen Testing are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.0.1] — 2026-04-20

Initial skeleton release (M0). End-to-end proof of the loop: scan → issue → agent → PR.

### Added
- Monorepo scaffold (pnpm + turborepo)
- `@oh-pen-testing/cli` with `init`, `scan`, `remediate` commands
- `@oh-pen-testing/core` engine: playbook loader, regex scanner with AI confirmation, Marinara agent
- `@oh-pen-testing/shared` types, Zod config schema, issue/scan data models
- `@oh-pen-testing/providers-anthropic` with prompt caching
- `@oh-pen-testing/git-github` adapter (simple-git + Octokit)
- `@oh-pen-testing/web` stub (Next.js 15, port 7676)
- First playbook: `hardcoded-secrets-scanner` with 6 regex rules + positive/negative fixtures
- Vitest suites: unit + mocked integration E2E
