# Oh Pen Testing

> Your code. Your AI. Your terms.

A free, opensource, locally-run penetration testing suite. Install it in your repo, connect your AI (Claude / OpenAI / Ollama — your credentials, your machine), and it runs OWASP-grade scans, files issues to a kanban board, and has pasta-named agents that open remediation PRs.

No SaaS. No code leaves your machine. No vendor lock-in. MIT licensed.

[![tests](https://github.com/Oh-Pen-Sauce/oh-pen-testing/actions/workflows/test.yml/badge.svg)](https://github.com/Oh-Pen-Sauce/oh-pen-testing/actions)
[![release](https://img.shields.io/github/v/release/Oh-Pen-Sauce/oh-pen-testing)](https://github.com/Oh-Pen-Sauce/oh-pen-testing/releases)
[![license](https://img.shields.io/badge/licence-MIT-blue)](./LICENCE)

---

## Quickstart

```bash
# In your project root
npx oh-pen-testing@latest init

# Zero config if you have `claude` on PATH (Claude Code CLI session)
# Otherwise set one of:
export ANTHROPIC_API_KEY=sk-ant-…
export GITHUB_TOKEN=ghp_…                   # for PR opening

# Scan, triage, remediate, verify
opt scan
opt remediate --all           # agent pool opens PRs for the whole board
opt approve --issue ISSUE-007 # unblock anything gated by autonomy mode
opt verify  --issue ISSUE-001 # confirm the fix landed
opt report  --format pdf      # consultancy-grade pen-test deliverable

# Prefer a UI?
opt setup   # opens http://127.0.0.1:7676 with the kanban + review queue
```

## What ships

### 22 OWASP Top 10 playbooks

| Cat | Coverage |
|---|---|
| A01 Broken Access Control | missing-authorisation-check, cors-wildcard |
| A02 Cryptographic Failures | weak-hash-algorithm, weak-random-for-security, insecure-tls-version, hardcoded-secrets |
| A03 Injection | sql-injection-raw, command-injection, xss-innerhtml, xxe-vulnerable-parser |
| A04 Insecure Design | no-rate-limit-on-auth |
| A05 Security Misconfiguration | debug-mode-enabled, default-credentials, verbose-error-exposure |
| A06 Vulnerable Components | sca (npm-audit + pip-audit + bundler-audit) |
| A07 Auth Failures | weak-password-policy, insecure-password-storage |
| A08 Integrity | missing-sri, insecure-deserialization |
| A09 Logging | sensitive-data-in-logs |
| A10 SSRF | user-controlled-fetch, metadata-service-access |

Every regex playbook ships with positive + negative test fixtures enforced in CI.

### 4 remediation agents

- **Marinara** 🍅 — injection, secrets, input-validation
- **Carbonara** 🥓 — crypto, secrets, TLS
- **Alfredo** 🧀 — auth, access-control, session
- **Pesto** 🌿 — dependencies, supply-chain

They run in parallel with a work-stealing queue so critical findings get picked up first.

### 3 autonomy modes

- **Careful** — every fix requires your approval
- **Recommended** (default) — auto-PR for non-critical; block on auth / secrets-rotation / schema migrations / large diffs
- **YOLO** — auto-PR for everything except the hard triggers

### BYO AI, BYO git

- Claude API, Claude Code CLI (**free on Max**), OpenAI, OpenRouter, Ollama
- GitHub (GitLab + Bitbucket via the `GitAdapter` interface in v1.0)

### Reports

- Markdown (human-readable)
- JSON (machine-readable)
- SARIF 2.1.0 (feeds GitHub Code Scanning / Snyk / Sonatype)
- PDF (consultancy-grade pen-test deliverable)

## Principles (non-negotiable)

1. **Authorised testing only** — scan refuses without explicit ack
2. **Local-first** — no telemetry, no phoning home
3. **BYO AI** — your credentials, your machine
4. **AI for reasoning, not unchecked power** — deterministic code discovers + applies; AI reasons + explains
5. **Evidence first, interpretation second** — scanner output separated from AI analysis in the UI
6. **Human review for remediation** — agents draft PRs; humans merge
7. **Single-user local tool in v1.0** — multi-user enterprise is a v2.0 decision

See [PRD.md](./PRD.md) for the full spec and [FUTURE_FEATURES.md](./FUTURE_FEATURES.md) for v1.0+ roadmap.

## Install

```bash
# npm (cross-platform)
npm install -g @oh-pen-testing/cli
# or just
npx oh-pen-testing@latest init

# Homebrew (tap published alongside v1.0.0)
brew tap oh-pen-sauce/tap
brew install oh-pen-testing

# Docker
docker pull ghcr.io/oh-pen-sauce/oh-pen-testing:1.0.0
docker run --rm -v "$PWD":/workspace -w /workspace \
  ghcr.io/oh-pen-sauce/oh-pen-testing:1.0.0 opt init

# From source
git clone https://github.com/Oh-Pen-Sauce/oh-pen-testing.git
cd oh-pen-testing
pnpm install
pnpm turbo run build
```

## Documentation

- [docs/getting-started.md](./docs/getting-started.md) — zero-to-first-scan
- [docs/playbook-authoring.md](./docs/playbook-authoring.md) — write your own playbook
- [docs/architecture.md](./docs/architecture.md) — how the monorepo fits together
- [docs/provider-setup.md](./docs/provider-setup.md) — Claude, OpenAI, Ollama configuration

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

See [SECURITY.md](./SECURITY.md).

## Licence

MIT. Free forever. Donations welcome — [oh-pen-sauce.com](https://oh-pen-sauce.com).
