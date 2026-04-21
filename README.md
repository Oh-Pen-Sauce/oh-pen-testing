# Oh Pen Testing

> Your code. Your AI. Your terms.

A free, opensource, locally-run penetration testing suite. Install it in your repo, connect your AI (Claude, OpenAI, Ollama — your tokens, your machine), and it runs OWASP-grade scans, files issues to a kanban board, and opens remediation PRs. No SaaS. No code leaves your machine.

**Status: v0.1.0 — M1**

## M1 capabilities

- Scaffold `.ohpentesting/` in a target repo (`oh-pen-testing init`)
- **Web UI** on `http://127.0.0.1:7676` with kanban, issue detail, scans, settings, and a 5-step setup wizard (`oh-pen-testing setup`)
- **Three providers**: Claude API (`claude-opus-4-7` default), Claude Code CLI (free on Max plan), Ollama (local, default model `kimi-k2.6`)
- **Rate-limit management**: budget cap for API providers, 5-hour rolling window for Claude Max, local-no-op for Ollama
- **Nightly schedule**: `oh-pen-testing schedule --nightly` (launchd on macOS, crontab on Linux)
- Scan for hardcoded secrets (AWS keys, GitHub PATs, Slack tokens, private keys) with AI confirmation
- Have **Marinara** 🍅 propose a fix, commit to a branch, and open a GitHub PR

## Known limitations (M1)

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

# Set credentials (env or keychain):
export ANTHROPIC_API_KEY=sk-ant-...
export GITHUB_TOKEN=ghp_...

# Scan and remediate:
oh-pen-testing scan
oh-pen-testing remediate --issue ISSUE-001
```

## Licence

MIT. Free forever. Donations accepted — see the website.
