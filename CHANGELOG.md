# Changelog

All notable changes to Oh Pen Testing are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-04-21

M1 — provider expansion, rate-limit management, and the first web UI.

### Added
- **Provider abstraction**: `AIProvider` extended with optional streaming (`completeStream`) and required `rateLimitStrategy()`. New provider registry / resolver in `@oh-pen-testing/core` so scanners and agents never hardwire a provider.
- **New provider: `@oh-pen-testing/providers-claude-code-cli`** — spawns the user's local `claude` CLI as a subprocess (non-streaming + streaming). Max-plan users pay $0 extra. Includes `detectClaudeCliInstalled()` and `detectClaudeCliFlags()` helpers.
- **New provider: `@oh-pen-testing/providers-ollama`** — hits a local Ollama server. Default model `kimi-k2.6`. Streaming via NDJSON on `/api/chat`. Includes `detectOllamaReachable()` for the setup wizard ping.
- **New package: `@oh-pen-testing/rate-limit`** — budget-based token accounting for API providers (soft cap / hard cap), rolling-window tracker for Claude Max session windows, local-no-op strategy for Ollama.
- **Rate-limit halt in `runScan`**: scan stops with a typed `RateLimitHalt` error when the manager signals exhaustion or the provider throws `RateLimitError`.
- **New package: `@oh-pen-testing/playbooks-core`** — exports an absolute `BUNDLED_PLAYBOOKS_DIR` path so consumers don't walk the filesystem. Fixes the fragile `../..` resolution before npm shipping.
- **CLI: `oh-pen-testing setup`** now spawns the web UI at `http://127.0.0.1:7676/setup` and auto-opens the browser (opt-out with `--no-open`).
- **CLI: `oh-pen-testing schedule --nightly`** installs a launchd plist on macOS or a crontab entry on Linux. Idempotent; `--remove` tears it down.
- **CLI: `oh-pen-testing scan --provider <id>`** overrides `config.ai.primary_provider` for a single run.
- **Web app** (Next.js 15 on `127.0.0.1:7676`):
  - Sidebar layout with persistent navigation
  - Dashboard home with per-severity counts, latest scan summary, and suggested-next-action engine
  - Six-column kanban (`/board`) matching `IssueStatus` enum; click to change status or open side panel
  - Issue detail (`/issue/[id]`) with code-context viewer and a "Remediate now" half-feature (Recommended mode + non-critical only; Careful mode + Critical blocked until M4)
  - Scans list + detail (`/scans`, `/scans/[id]`)
  - Settings editor (`/settings`) that persists to `.ohpentesting/config.yml` via server actions
  - Five-step setup wizard (`/setup`): provider → credentials → GitHub → autonomy → risky tests
- **Tailwind 4** upgrade (CSS-first config via `@theme`; `@tailwindcss/postcss` plugin).
- **Keychain-first credential flow**: setup wizard writes API keys and GitHub PATs to the OS keychain via keytar (optional dep), never to files.
- **New tests**: 12 more tests (27 total, 9 suites) covering rate-limit manager, Ollama provider, rate-limit scan halt, programmatic wizard effect.

### Changed
- `ScanRun` schema's `checkpoint` field is still present but unused — checkpointed scan resume deferred to a later milestone per user decision KU6.

### Removed
- `SECURITY.md` is unchanged; release workflow stub stays at M5.

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
