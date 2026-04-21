# Oh Pen Testing

> Your code. Your AI. Your terms.

A free, opensource, locally-run penetration testing suite. Install it in your repo, connect your AI (Claude, OpenAI, Ollama — your tokens, your machine), and it runs OWASP-grade scans, files issues to a kanban board, and opens remediation PRs. No SaaS. No code leaves your machine.

**Status: v0.2.0 — M2**

## M2 capabilities

Everything in M1, plus:

- **Authorisation gate** — every scan requires explicit acknowledgement. Setup wizard has a required checkbox; CLI prompts on first scan in any repo. Hard-refuses to proceed without it.
- **Scope policy** — `scope.time_windows`, `scope.allowed_targets`, `scope.rate_limits` in `config.yml` enforced before each playbook. Schedule scans to only run overnight; refuse scans against targets you don't own.
- **Verification rerun** — `opt verify --issue ISSUE-001` re-runs the playbook to confirm a fix landed. Issues transition to `verified` when zero hits remain. "Verify fix" button on the web `/issue/[id]` page.
- **Evidence/AI split** — issue detail page shows raw scanner output and AI analysis in two distinct columns with provenance metadata. Separates what the scanner literally found from what the LLM said about it.
- **SARIF 2.1.0 export** — `opt report --format sarif` emits GitHub Code Scanning-compatible output. Markdown + JSON formats also fleshed out.

## M1 capabilities (still here)

- Scaffold `.ohpentesting/` in a target repo (`opt init`)
- **Web UI** on `http://127.0.0.1:7676` with 7-column kanban, issue detail, scans, settings, and a 6-step setup wizard (`opt setup`)
- **Three providers**: Claude API (`claude-opus-4-7` default), Claude Code CLI (free on Max plan), Ollama (local, default model `kimi-k2.6`)
- **Rate-limit management**: budget cap for API providers, 5-hour rolling window for Claude Max, local-no-op for Ollama
- **Nightly schedule**: `opt schedule --nightly` (launchd on macOS, crontab on Linux)
- Scan for hardcoded secrets (AWS keys, GitHub PATs, Slack tokens, private keys) with AI confirmation
- Have **Marinara** 🍅 propose a fix, commit to a branch, and open a GitHub PR

## Known limitations (M2)

- One playbook: `hardcoded-secrets-scanner` (the full OWASP Top 10 lands in M3)
- One agent: Marinara (Carbonara, Alfredo, Pesto land in M4 with the agent pool)
- One git host: GitHub (GitLab + Bitbucket land in v1.0)
- "Remediate now" button in the web UI ships as a half-feature: Recommended autonomy + non-critical issues only; Careful mode and critical issues require the CLI until M4
- No dynamic testing yet — v1.0

See [PRD.md](./PRD.md) for v0.5 scope and [FUTURE_FEATURES.md](./FUTURE_FEATURES.md) for v1.0+ roadmap.

## Quickstart

```bash
# In your project root:
npx oh-pen-testing init

# The CLI will prompt for an authorisation ack on first scan.
# No API key needed if `claude` is on PATH (uses your OAuth session):
opt scan
opt remediate --issue ISSUE-001
opt verify --issue ISSUE-001

# Alternative: use an API key
export ANTHROPIC_API_KEY=sk-ant-...
export GITHUB_TOKEN=ghp_...
opt scan

# Or fully local with Ollama:
ollama serve && ollama pull kimi-k2.6
opt scan --provider ollama

# Launch the web UI (kanban, setup wizard, settings):
opt setup

# Generate a report:
opt report --format sarif  # → .ohpentesting/reports/oh-pen-testing.sarif
opt report --format markdown
```

## Licence

MIT. Free forever. Donations accepted — see the website.
