# Oh Pen Testing — repo-local primer

This file auto-loads whenever a Claude session opens in this repo.

## What this repo is

A local-first opensource pen-testing suite: CLI + web UI + bundled
playbooks. v1.0.0 is PRD-complete; the full implementation history
lives in commit log + [NOTES.md](./NOTES.md).

## Layout (pnpm workspace + turborepo)

- `packages/cli/` — the `opt` / `oh-pen-testing` binary users install
- `packages/web/` — Next.js web UI (served by `opt setup`)
- `packages/core/` — scanner, agent pool, dynamic runner, provider router
- `packages/shared/` — config schema, secrets store, SARIF/PDF/SBOM builders, setup-assistant bundle
- `packages/rate-limit/` — cost/session budget manager
- `packages/providers/{anthropic,claude-code-cli,ollama}/` — AI backends
- `packages/git-adapters/{github,gitlab,bitbucket}/` — PR plumbing
- `playbooks/core/` — bundled rules under `{secrets,owasp,sca,wstg,cwe-top-25,iac,asvs}/`
  Each playbook: `manifest.yml` + `scan.prompt.md` + `remediate.prompt.md` + `tests/{positive,negative}/*`

## Golden rules

### 1. Keep install notes in sync with reality

**The install path is a load-bearing user contract.** Whenever a change
touches any of the following, update [`README.md`](./README.md)'s
Install section AND [`PUBLISHING.md`](./PUBLISHING.md) in the same PR:

- Adding, removing, or renaming any workspace package
- Flipping a package's `private` flag (publishable ↔ internal-only)
- Changing runtime dependencies of a published package
- Touching `packages/cli/tsup.config.ts` in a way that affects the
  built CLI (shebang, bundle format, externals)
- Changing the Node `engines` floor
- Adding a new secret the CLI reads (env var name, keychain account)
- Adding a new install target (Homebrew, Docker, a different registry)
- A new CLI subcommand that changes first-run UX (e.g. `opt connect`
  becoming mandatory before `opt setup`)

Failure mode without this rule: users hit `npm install -g` → `opt`
errors → they file a bug → we realise README is lying. Happened once
for `@oh-pen-testing/playbooks-core` missing the `iac` dir in its
`files` list. Don't let it happen again.

### 2. The scan target is cwd, not `git.repo`

Oh Pen Testing scans whatever directory the CLI / web server was
launched from. `git.repo` in config is only used for PR creation.
Any copy that implies otherwise (wizard prompts, memory files, error
messages) is wrong and must be fixed. The `ScanTargetBanner` in
`packages/web/src/components/trattoria/` exists specifically to make
this visible on every page.

### 3. Secrets never hit files or logs

Three-tier secrets store in `packages/shared/src/secrets-store.ts`:
env var → OS keychain → `~/.ohpentesting/secrets.json` (mode 0600,
user-only, outside any repo). Never read or write secrets any other
way. Never log their values. The chat UI masks token-shaped user
input before display — preserve that invariant.

### 4. The setup-assistant bundle is the product

`packages/shared/src/setup-assistant/assets/` — memory.md + 9 skill
markdown files — is a portable artifact. Any AI that can read
markdown + emit JSON can run onboarding. Keep it provider-agnostic:
no Claude-specific phrasing, no OpenAI-specific calls. Skill
frontmatter must stay schema-valid (checked by
`loader.test.ts`).

### 5. Fixture-gate tests drive playbook quality

`packages/core/src/scanner/regex-scanner.test.ts` auto-discovers
every manifest under `playbooks/core/` and runs positive/negative
fixtures. Adding a new playbook means adding fixtures. The test
suite stays passing as an automatic invariant.

## Release

`pnpm turbo run build` + `pnpm test` must stay green. When bumping
versions, use `pnpm -r` so all published packages move together —
see [PUBLISHING.md](./PUBLISHING.md) for the full release runbook
including dependency-order publish.
