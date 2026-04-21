# Contributing to Oh Pen Testing

Thanks for considering a contribution. This is an MIT-licensed OSS project with no commercial tier — every PR improves the tool for everyone who uses it.

## Getting set up

```bash
# One-time
git clone https://github.com/Oh-Pen-Sauce/oh-pen-testing.git
cd oh-pen-testing
pnpm install
pnpm turbo run build

# Every time
pnpm test           # must stay green
pnpm turbo run typecheck   # must be clean
```

Node 22+ and pnpm 10+ required.

## Project layout

- `packages/shared/` — Zod schemas, issue/scan models, AIProvider interface, SARIF emitter
- `packages/core/` — scanner engine, playbook runner, scope enforcement, verification, agent pool
- `packages/cli/` — `oh-pen-testing` / `opt` command entrypoint (commander)
- `packages/web/` — Next.js 15 UI on `:7676` (kanban, reviews, setup wizard)
- `packages/providers/{anthropic,claude-code-cli,ollama}/` — AIProvider implementations
- `packages/git-adapters/github/` — PR orchestrator (GitLab + Bitbucket land in v1.0)
- `packages/rate-limit/` — budget-based + rolling-window rate managers
- `playbooks/core/` — curated playbook library (OWASP Top 10 + secrets)

## Writing a new playbook

See [docs/playbook-authoring.md](./docs/playbook-authoring.md). Short version:

1. `mkdir -p playbooks/core/<category>/<your-playbook>/tests/{positive,negative}`
2. Add `manifest.yml`, `scan.prompt.md`, `remediate.prompt.md` (copy an existing playbook as a template).
3. Put code fixtures that **should** match under `tests/positive/` and ones that **shouldn't** under `tests/negative/`.
4. `pnpm test` — the fixture-gate auto-discovers your playbook and fails if your regex over- or under-matches.

## Commits

- Conventional commits preferred: `feat(core): …`, `fix(cli): …`, `docs: …`, `chore: …`.
- Every commit must leave the repo in a state where `pnpm test` passes.
- Include a `Co-Authored-By:` line for any AI-assisted work.

## Dogfood check

Before a release we run Oh Pen Testing **on itself**:

```bash
pnpm dogfood
```

This invokes the CLI against the repo and asserts the only findings are pre-known / allowlisted fixtures. Breaks CI if a real new finding lands.

## Security-sensitive changes

PRs that touch these areas get extra scrutiny (expect a "Wonk review" label):

- `packages/core/src/scope/enforce.ts` — authorisation gate
- `packages/core/src/agent/run-agent.ts` — autonomy gate + PR orchestration
- `packages/core/src/scanner/confirm.ts` — prompt-injection defence (the AI-untrusted-code delimiter convention)
- Any new `type: sca` playbook that shells out to an external tool
- Any new playbook that's `risky: true`

## Questions

Open a GitHub issue tagged `question` or email hello@oh-pen-sauce.com.
