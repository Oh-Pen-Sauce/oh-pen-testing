# Changelog

All notable changes to Oh Pen Testing are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0] - 2026-06-11

A security hardening pass for handing the tool to external testers, plus broader scanner coverage: 27 OWASP playbooks, a 14-detector secrets ruleset, polyglot SCA, a real AST code-injection check, and a tested dynamic (DAST) findings path. Install is quieter too, with the install-time deprecation warnings gone.

### Added
- **Five new OWASP playbooks**, taking the catalogue from 22 to 27:
  - `a07` JWT none-algorithm (CWE-347): JWTs signed or verified with `alg: none`, including the algorithm-confusion case where `none` is not first in the list, and uppercase `NONE`.
  - `a02` insecure cipher mode (CWE-327): AES-ECB, DES/3DES, RC4.
  - `a02` weak RSA key length (CWE-326): RSA modulus under 2048 bits.
  - `a03` prototype pollution (CWE-1321): `__proto__` writes and untrusted merge/assign.
  - `a03` code-injection-eval (CWE-95): the first AST-backed check (see below).
- **AST playbook runtime** (`type=ast`). Previously declared in the schema but skipped at runtime, it now runs a Babel-backed scanner. The first built-in check flags `eval()` and `new Function()` called with a non-literal argument, a precision regex cannot reach: it tells `eval` of a string literal apart from `eval` of user input by inspecting the argument node.
- **osv-scanner as a polyglot SCA source.** SCA previously covered only npm, pip, and bundler. With osv-scanner on PATH, scans now also cover Go, Rust, Java/Maven, PHP/Composer, and more from a single tool. It runs only when a recognised dependency manifest is present and skips silently (recorded as a skipped source) when the binary is absent.
- **Eight more secrets detectors**, expanding the built-in ruleset from 6 to 14: Stripe, OpenAI, Google API key, GCP service account, SendGrid, GitLab PAT, npm token, and Twilio. Each is precise and tuned to be low false-positive.
- **A distinct AI-confidence axis on findings.** The confirm step now reports how sure it is a finding is a true positive, independent of how severe it is, rather than deriving confidence from severity.
- **`cancelled` scan status.** Cancelling a scan now finalises the record as a real `cancelled` status, with a CANCELLED badge in the web board, instead of being overloaded onto `checkpointed`.
- **Richer `opt info`**: shows the scan target, whether config is present, the configured provider/model/autonomy, and whether credentials exist (location only, never the value).
- **Node 22+ runtime check** in the CLI, with `info`/`help`/`version` exempt so users on older Node can still diagnose, plus a "run `opt setup`" hint when invoked with no subcommand.
- **Stryker mutation-testing scaffold** (`pnpm mutation`), scoped to the safety-critical scope and rate-limit modules. Run on demand, not in CI.
- **A real CI gate**: ESLint flat config (`pnpm lint`), vitest v8 coverage with floor thresholds (`pnpm coverage`), a green dogfood step, an advisory `pnpm audit`, a frozen lockfile, an Ubuntu + macOS test matrix, and npm `--provenance` publishing with OIDC attestation.

### Changed
- **Default keychain backend switched from keytar to `@napi-rs/keyring`.** keytar is unmaintained; the replacement ships a compat shim with the same API, so credential storage in the OS keychain is unchanged for users. As part of this, keychain access is now an optional dependency that CLI-only installs actually receive, so they get the OS keychain tier instead of silently falling back to the file store.
- **The autonomy gate now keys off deterministic fields only** (playbook id, OWASP category, CWE code), never the issue title. Titles are the one field a scanned repo could influence, so they can no longer relax or trip the gate. The gate also now reads OWASP categories and CWE codes, so real auth and secrets findings still gate.
- **Web wizard UX**: the Autonomy step now leads with the Recommended option; "Full YOLO" (no safety gate) moved behind a "Show advanced" disclosure that auto-opens only if it is already your saved choice. The chat message list is now an accessible live log, and the composer input and send button have proper labels.
- API-key providers no longer report a misleading "Ready" before the key is used; they report a deferred state, with the key validated on first use.
- README, CHANGELOG, and docs corrected for accuracy: supported providers restated to what actually ships (Claude API, Claude Code CLI, Ollama, with OpenAI/OpenRouter next), coverage claims fixed, and version hints unstuck from old numbers.
- House-style pass across the repo: every em-dash replaced with the punctuation it was standing in for, spanning docs, CLI output, web copy, comments, and playbook prompts. Behaviour-preserving, strings and comments only.

### Fixed
- **No more install-time deprecation warnings.** A fresh `npx @oh-pen-testing/cli@latest setup` previously printed three npm deprecation warnings (`node-domexception`, `jpeg-exif`, `prebuild-install`) from transitive deps. Bumping `@anthropic-ai/sdk`, `pdfkit`, and the keychain library off the offending versions clears all three.
- **`next dev` crash with "agent assets not found"** when `dist/agents-assets/` was missing (for example after a fresh clone with no build). The agents loader now falls back to source correctly, so a forgotten build no longer takes down the dev flow.
- **Scanner-accuracy fixes** from an adversarial review of the hardening branch:
  - JWT none-algorithm now matches `none` anywhere in an algorithms list and is case-insensitive.
  - Prototype-pollution deep-merge detection (a stray literal backspace in the pattern meant it was not matching; now also catches `Object.assign` / `assign` / `mergeWith`).
  - Secrets detectors widened for real-world variants: GitHub `ghr_` tokens, OpenAI `sk-svcacct-`/`sk-admin-` keys, and `ENCRYPTED PRIVATE KEY` blocks.
- Unsupported playbook types now log a visible warning when skipped, so a third-party playbook of an unsupported type is no longer silently counted as skipped.
- The release workflow's changelog extraction matched the version heading as a regex, where `[1.0.3]` is a character class, producing wrong or empty release notes. It now matches the heading literally. The npm publish gate was also fixed to read its token correctly.
- Backfilled the missing 1.0.0, 1.0.1, and 1.0.3 CHANGELOG entries (the release workflow ships empty notes for any tag without a matching section).
- Docker `opt` shim repaired: it pointed at a non-existent path, so `opt` did not resolve inside the container; the web UI now also binds to `0.0.0.0` so it is reachable from the host.

### Security
- **Path-containment guard on every agent file read and write.** Each path is resolved through a two-layer check (lexical `..` plus realpath for symlinks), so a tampered finding's recorded file location can never read or write outside the repo. A TOCTOU window between the early path check and the post-LLM write is closed by re-resolving the target and writing through an `O_NOFOLLOW` handle.
- **The one-shot retry patch is now screened** for a newly introduced `eval` / `new Function` / `document.write` or a size explosion, and held for human approval if flagged. Fail-closed and deliberately narrow to avoid blocking real fixes.
- **The `large_diff` approval trigger is now actually evaluated.** It shipped in the defaults but was never wired up; a patch changing more than `max(200, estimated * 5)` lines is now held for approval.
- **ReDoS guard in the regex scanner.** Files with a pathologically long line (default 5000 chars) are skipped, closing the main catastrophic-backtracking vector when scanning untrusted repos. URL scope matching also re-checks the parsed protocol is http or https.
- **The dynamic (DAST) finding-to-issue path is now extracted and tested.** The scope gates that protect a live target (refuse without authorisation, refuse an out-of-scope target, block a probe that tries to escape the allowed origin) previously had no test coverage; they now do, and dynamic findings can carry CWE/OWASP classification. Dynamic findings remain high-confidence but never auto-fixable and always require approval.
## [1.0.3] - 2026-05-17

Setup polish and in-app docs. Thanks to Joe (@Veridex-AI) for the fix-pack (PR #2).

### Fixed
- **`opt setup` first-run reliability.** Port-in-use is detected before bind, with a clear error and a remediation hint. The CLI now health-polls the wizard over HTTP (300ms interval, 30s cap) before opening the browser instead of sleeping, so the browser no longer opens to a blank page on slower machines.
- **Init guard.** `opt scan`, `opt remediate`, and `opt verify` print a friendly "no `.ohpentesting/config.yml` found, run `opt setup`" message instead of a stack trace when run before setup.
- **Hook-manager detection.** Setup no longer overwrites `.git/hooks/pre-commit` when husky or lefthook is present; it tells you how to wire `opt check` into your existing config instead.

### Added
- **`--port <n>` flag** on `opt setup` to override the default 7676.
- **In-app `/docs` section** in the web wizard (install, setup, first scan, agents, reports).
- **"Done" pill** on completed wizard steps.
- **LICENSE file** at the repo root (the `package.json` already declared MIT).

### Changed
- README provider list corrected to what ships today (Claude API, Claude Code CLI, Ollama); OpenAI and OpenRouter noted as next.

## [1.0.2] - 2026-04-29

### Fixed
- **`opt setup` now works from a global npm install.** The `1.0.1` tarball didn't ship the web wizard and the command spawned `pnpm start`, so users hit `ENOENT: no such file or directory, stat '.../node_modules/web'` and `spawn pnpm ENOENT`. Three changes land together (the third caught during smoke-testing PR #1):
  - `@oh-pen-testing/web` is now a published package and a runtime dependency of `@oh-pen-testing/cli`. The wizard's `.next` build output ships in the tarball.
  - `setup.ts` resolves the web package via Node module resolution (`createRequire` → `@oh-pen-testing/web/package.json`) and spawns `next start` directly using the `next` binary resolved from the web package, with no `pnpm` required at runtime. A monorepo-dev fallback path is preserved.
  - `next.config.ts` → `next.config.mjs`. The published web tarball ships only runtime deps (no `typescript`), and Next 15's TS-config loader was hot-installing `typescript` via pnpm at first `next start`. Plain ESM config skips that detour: the wizard boots immediately even on machines without pnpm. Type safety preserved via a JSDoc `@type {import("next").NextConfig}` annotation.
- **`CLI_VERSION` in `packages/cli/src/index.ts` now follows package.json.** Hardcoded constant got missed in the 1.0.1 bump, so `opt --version` printed `1.0.0` against an npm-installed `1.0.1`. Now both report `1.0.2`.

## [1.0.1] - 2026-04-28

### Fixed
- Packaging fixes ahead of the 1.0.2 setup-wizard repair. The 1.0.1 tarball did not ship the web wizard build; see 1.0.2 for the full story and resolution.

## [1.0.0] - 2026-04-21

PRD feature-complete. First public release.

### Added
- Playbook catalogue across OWASP Top 10, a CWE Top 25 subset, IaC, secrets, and WSTG, every regex playbook gated by positive and negative fixtures in CI.
- AI-confirmed scanning: deterministic regex discovery, then provider confirmation with evidence separated from AI analysis.
- Pasta-named remediation agents (Marinara, Carbonara, Alfredo, Pesto) with a work-stealing queue and autonomy gating (Careful, Recommended, YOLO).
- Reports in Markdown, JSON, SARIF 2.1.0, and PDF.
- GitHub PR remediation and scheduled scans (launchd on macOS, crontab on Linux).

## [0.6.0] - 2026-04-21

M6: PDF pen-test report (the v1.0 crown jewel, landed ahead of schedule).

### Added
- **`buildPdfReport`** in `@oh-pen-testing/shared`: pdfkit-based (no Chromium dependency). Cover page, executive summary with severity bar chart, methodology with bundled-standards list, per-finding detail with scanner output + AI analysis split and chip row (severity, OWASP ref, CWE, status), residual-risks page, signature page.
- **`opt report --format pdf`**: writes to `.ohpentesting/reports/oh-pen-testing-report.pdf` by default; `-o` overrides. Output is a valid PDF 1.3 document suitable for enterprise buyer due-diligence packets, investor rooms, SOC2 evidence folders.
- PDF metadata includes title, author (`Oh Pen Testing v<version>`), subject, and producer, all searchable in the reader.

### Changed
- `opt report --format <fmt>` now accepts `pdf` alongside `markdown | json | sarif`.

## [0.5.0] - 2026-04-21

M5: launch polish. Docs, dogfood, release workflow, Homebrew formula reference.

### Added
- **README.md** rewritten as a landing page: zero-config quickstart, OWASP coverage table, agent roster, autonomy modes, provider matrix, 7 non-negotiable principles, install matrix.
- **docs/**: getting-started, playbook-authoring, architecture, provider-setup guides.
- **CONTRIBUTING.md**: project layout + commit conventions + fixture-gate contract + dogfood step + security-sensitive-file list.
- **Homebrew formula** at `Formula/oh-pen-testing.rb` (reference; real tap lives at `oh-pen-sauce/homebrew-tap`).
- **`.github/workflows/release.yml`**: triggers on `v*` tag push: typecheck + build + test → publishes `@oh-pen-testing/*` to npm (if `NPM_TOKEN` secret set) → creates GitHub Release with changelog-extracted notes.
- **`scripts/dogfood.mjs`** + **`pnpm dogfood`**: runs the regex layer of our own playbooks against the repo. Allowlists fixtures, docs, tests. Currently clean across 122 files and 21 regex playbooks.

## [0.4.0] - 2026-04-21

M4: Agent pool + autonomy enforcement.

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

## [0.3.0] - 2026-04-21

M3: OWASP Top 10 coverage. 22 playbooks across all ten categories, each with positive/negative fixtures auto-exercised by the fixture-gate test harness.

### Added

**Framework**:
- **SCA playbook type**: new `type: sca` in `PlaybookManifestSchema` with `sca_sources: [npm-audit | pip-audit | bundler-audit]`. Runtime shells out to the relevant auditors (skipping those whose manifest file is absent), normalises their output into standard Issue shape, skips AI confirmation (auditor verdicts are authoritative).
- **Auto-discovery fixture-gate test harness**: `regex-scanner.test.ts` now walks every playbook under `playbooks/core/`, discovers `tests/positive/` and `tests/negative/` dirs, enforces the contract (positive MUST match, negative must NOT match) for every one. New playbooks get tested with zero test-file edits.

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
- Every OWASP finding now tags itself with the category (A01-A10), CWE IDs, and default severity; this feeds directly into SARIF exports and the PDF report planned for v1.0.

### Tests
- 86/86 passing across 14 suites (was 46/13 in v0.2.0).
- 40 new auto-generated fixture-gate tests across the 20 new regex playbooks.

## [0.2.0] - 2026-04-21

M2: trust and verification. Joe's PRD review produced a short list of gaps; this release closes them.

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

## [0.1.0] - 2026-04-21

M1: provider expansion, rate-limit management, and the first web UI.

### Added
- **Provider abstraction**: `AIProvider` extended with optional streaming (`completeStream`) and required `rateLimitStrategy()`. New provider registry / resolver in `@oh-pen-testing/core` so scanners and agents never hardwire a provider.
- **New provider: `@oh-pen-testing/providers-claude-code-cli`**: spawns the user's local `claude` CLI as a subprocess (non-streaming + streaming). Max-plan users pay $0 extra. Includes `detectClaudeCliInstalled()` and `detectClaudeCliFlags()` helpers.
- **New provider: `@oh-pen-testing/providers-ollama`**: hits a local Ollama server. Default model `kimi-k2.6`. Streaming via NDJSON on `/api/chat`. Includes `detectOllamaReachable()` for the setup wizard ping.
- **New package: `@oh-pen-testing/rate-limit`**: budget-based token accounting for API providers (soft cap / hard cap), rolling-window tracker for Claude Max session windows, local-no-op strategy for Ollama.
- **Rate-limit halt in `runScan`**: scan stops with a typed `RateLimitHalt` error when the manager signals exhaustion or the provider throws `RateLimitError`.
- **New package: `@oh-pen-testing/playbooks-core`**: exports an absolute `BUNDLED_PLAYBOOKS_DIR` path so consumers don't walk the filesystem. Fixes the fragile `../..` resolution before npm shipping.
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
- `ScanRun` schema's `checkpoint` field is still present but unused; checkpointed scan resume deferred to a later milestone per user decision KU6.

### Removed
- `SECURITY.md` is unchanged; release workflow stub stays at M5.

## [0.0.1] - 2026-04-20

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
