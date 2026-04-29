# Changelog

All notable changes to Oh Pen Testing are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.2] — 2026-04-29

### Fixed
- **`opt setup` now works from a global npm install.** The `1.0.1` tarball didn't ship the web wizard and the command spawned `pnpm start`, so users hit `ENOENT: no such file or directory, stat '.../node_modules/web'` and `spawn pnpm ENOENT`. Two changes land together:
  - `@oh-pen-testing/web` is now a published package and a runtime dependency of `@oh-pen-testing/cli`. The wizard's `.next` build output ships in the tarball.
  - `setup.ts` resolves the web package via Node module resolution (`createRequire` → `@oh-pen-testing/web/package.json`) and spawns `next start` directly using the `next` binary resolved from the web package — no `pnpm` required at runtime. A monorepo-dev fallback path is preserved.

## [0.6.0] — 2026-04-21

M6 — PDF pen-test report (the v1.0 crown jewel, landed ahead of schedule).

### Added
- **`buildPdfReport`** in `@oh-pen-testing/shared` — pdfkit-based (no Chromium dependency). Cover page, executive summary with severity bar chart, methodology with bundled-standards list, per-finding detail with scanner output + AI analysis split and chip row (severity, OWASP ref, CWE, status), residual-risks page, signature page.
- **`opt report --format pdf`** — writes to `.ohpentesting/reports/oh-pen-testing-report.pdf` by default; `-o` overrides. Output is a valid PDF 1.3 document suitable for enterprise buyer due-diligence packets, investor rooms, SOC2 evidence folders.
- PDF metadata includes title, author (`Oh Pen Testing v<version>`), subject, and producer — searchable in the reader.

### Changed
- `opt report --format <fmt>` now accepts `pdf` alongside `markdown | json | sarif`.

## [0.5.0] — 2026-04-21

M5 — launch polish. Docs, dogfood, release workflow, Homebrew formula reference.

### Added
- **README.md** rewritten as a landing page — zero-config quickstart, OWASP coverage table, agent roster, autonomy modes, provider matrix, 7 non-negotiable principles, install matrix.
- **docs/** — getting-started, playbook-authoring, architecture, provider-setup guides.
- **CONTRIBUTING.md** — project layout + commit conventions + fixture-gate contract + dogfood step + security-sensitive-file list.
- **Homebrew formula** at `Formula/oh-pen-testing.rb` (reference; real tap lives at `oh-pen-sauce/homebrew-tap`).
- **`.github/workflows/release.yml`** — triggers on `v*` tag push: typecheck + build + test → publishes `@oh-pen-testing/*` to npm (if `NPM_TOKEN` secret set) → creates GitHub Release with changelog-extracted notes.
- **`scripts/dogfood.mjs`** + **`pnpm dogfood`** — runs the regex layer of our own playbooks against the repo. Allowlists fixtures, docs, tests. Currently clean across 122 files and 21 regex playbooks.

## [0.4.0] — 2026-04-21

M4 — Agent pool + autonomy enforcement.

### Added
- **4 named agents**: Marinara 🍅 (injection), Carbonara 🥓 (crypto), Alfredo 🧀 (auth), Pesto 🌿 (dependencies). Each with specialty-tuned system prompts.
- **Work-stealing agent pool** (`runAgentPool`) with per-agent bucket assignment + cross-bucket stealing by severity.
- **Full autonomy-mode enforcement**: careful blocks all, recommended blocks critical + approval_triggers, yolo allows everything except approval_triggers.
- **`pending_approval` issue status** + new "Pending Approval" kanban column.
- **`/reviews` web route** with approve/reject server actions.
- **`opt remediate --all [--severity <level>]`** runs the full pool with live progress.
- **`opt approve --issue <id>`** unblocks a gated issue.

### Tests
99/99 passing (was 86). 13 new tests in agent-pool.test.ts.

## [0.3.0] — 2026-04-21

M3 — OWASP Top 10 coverage. 22 playbooks across all ten categories, each with positive/negative fixtures auto-exercised by the fixture-gate test harness.

### Added

**Framework**:
- **SCA playbook type** — new `type: sca` in `PlaybookManifestSchema` with `sca_sources: [npm-audit | pip-audit | bundler-audit]`. Runtime shells out to the relevant auditors (skipping those whose manifest file is absent), normalises their output into standard Issue shape, skips AI confirmation (auditor verdicts are authoritative).
- **Auto-discovery fixture-gate test harness** — `regex-scanner.test.ts` now walks every playbook under `playbooks/core/`, discovers `tests/positive/` and `tests/negative/` dirs, enforces the contract (positive MUST match, negative must NOT match) for every one. New playbooks get tested with zero test-file edits.

**22 playbooks** (21 regex + 1 SCA):
- **A01 Broken Access Control (2)**: missing-authorisation-check, cors-wildcard
- **A02 Cryptographic Failures (3)**: weak-hash-algorithm, weak-random-for-security, insecure-tls-version (+ existing hardcoded-secrets from M0)
- **A03 Injection (4)**: sql-injection-raw, command-injection, xss-innerhtml, xxe-vulnerable-parser
- **A04 Insecure Design (1)**: no-rate-limit-on-auth
- **A05 Security Misconfiguration (3)**: debug-mode-enabled, default-credentials, verbose-error-exposure
- **A06 Vulnerable Components (1 SCA)**: npm-audit + pip-audit + bundler-audit bundled
- **A07 Auth Failures (2)**: weak-password-policy, insecure-password-storage
- **A08 Integrity (2)**: missing-sri, insecure-deserialization
- **A09 Logging (1)**: sensitive-data-in-logs
- **A10 SSRF (2)**: user-controlled-fetch, metadata-service-access

Each playbook ships: `manifest.yml` with regex rules + metadata, `scan.prompt.md` for AI confirmation guidance, `remediate.prompt.md` for fix strategy, positive and negative test fixtures.

### Changed
- Every OWASP finding now tags itself with the category (A01-A10), CWE IDs, and default severity — feeds directly into SARIF exports and the PDF report planned for v1.0.

### Tests
- 86/86 passing across 14 suites (was 46/13 in v0.2.0).
- 40 new auto-generated fixture-gate tests across the 20 new regex playbooks.

## [0.2.0] — 2026-04-21

M2 — trust and verification. Joe's PRD review produced a short list of gaps; this release closes them.

### Added
- **Authorisation gate** (PRD Principle 1, § 6.10): new `scope:` block in `config.yml` with `authorisation_acknowledged`, `authorisation_acknowledged_at`, `authorisation_acknowledged_by`. Scans refuse to start without the ack. Setup wizard gains a required checkbox step; `opt scan` prompts on first run in any repo and persists the ack. New `ScopeViolation` error class with typed kinds.
- **Scope policy enforcement** (PRD § 6.10): `scope.time_windows`, `scope.allowed_targets`, `scope.rate_limits.default` all enforced in `runScan` before any playbook fires. Time windows support same-day and crosses-midnight ranges in any Intl timezone. Target allowlist supports path prefixes (v0.5 static) and URL origins (v1.0 dynamic testing forward-compat).
- **Verification rerun** (PRD § 6.11): new `verified` issue status. New `Issue.verification` block tracks `last_run_scan_id`, `last_run_at`, `hits_remaining`, `verified_at`. `opt verify --issue <ID>` command re-runs the playbook that flagged the issue against the current file state. Web adds a "Verify fix" button on `/issue/[id]` and a "Verified" column on the kanban.
- **Evidence/AI interpretation split** (PRD Principle 5): richer `Issue.evidence` schema with optional `rule_id`, `match_position`, `ai_reasoning`, `ai_model`, `ai_confidence`. `/issue/[id]` now renders scanner output (machine-verifiable) and AI analysis (advisory) in two clearly-separated columns with a "Provenance" collapsible.
- **SARIF 2.1.0 export**: `opt report --format sarif` emits a GitHub Code Scanning–compatible log. Also fleshed out the markdown report format with per-severity summary + per-issue detail using the evidence/AI split.

### Changed
- `scaffold()` gains `authorisationAcknowledged: boolean` option for tests and programmatic setups.
- Setup wizard is now 6 steps instead of 5 (Authorisation inserted between Autonomy and Risky).
- Kanban board gains a 7th column (Verified).

### Tests
- 46/46 tests across 13 suites (was 27/9 in v0.1.0): added auth-gate, scope-enforcement, verification-rerun, and SARIF-emission test suites.

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
