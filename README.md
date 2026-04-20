# Oh Pen Testing

> Your code. Your AI. Your terms.

A free, opensource, locally-run penetration testing suite. Install it in your repo, connect your AI (Claude, OpenAI, Ollama — your tokens, your machine), and it runs OWASP-grade scans, files issues to a kanban board, and opens remediation PRs. No SaaS. No code leaves your machine.

**Status: v0.0.1 — M0 skeleton**

## M0 capabilities

M0 is the end-to-end proof. It can:

- Scaffold `.ohpentesting/` in a target repo (`oh-pen-testing init`)
- Scan for hardcoded secrets (AWS keys, GitHub PATs, Slack tokens, private keys) with AI confirmation
- Have **Marinara** 🍅 propose a fix, commit to a branch, and open a GitHub PR

## Known limitations (M0)

- One playbook: `hardcoded-secrets-scanner`
- One agent: Marinara
- One AI provider: Claude API (requires `ANTHROPIC_API_KEY`)
- One git host: GitHub (requires `GITHUB_TOKEN`)
- No web UI yet (stub only) — kanban and setup wizard land in M1
- No dynamic testing yet — M1+

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
