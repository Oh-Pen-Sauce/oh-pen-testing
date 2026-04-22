---
id: troubleshoot_claude_cli
name: Troubleshoot Claude Code CLI detection
when_to_use: >
  `probe_provider` for claude-code-cli returned ok:false, and the user is
  trying to fix the install rather than switch providers. This skill has
  no action — it's purely informational content you can reference when
  composing your `say`.
input_schema:
  type: object
  additionalProperties: false
  properties: {}
---

# troubleshoot_claude_cli

The detection runs `claude --version`. If that fails, one of these is usually why.

## Fix #1 — Not installed

Most common. Point the user at:

> Install from https://claude.ai/download, or on macOS: `brew install anthropic/claude/claude`.

## Fix #2 — Not on PATH

Installed via a different user / shell profile that the web server's child process can't see. Ask the user to run `which claude` in the same terminal where they launched Oh Pen Testing. If it prints a path, they need to restart the web server after opening a fresh shell (so the new PATH is inherited).

## Fix #3 — Session expired

If `claude --version` works but the provider still reports unauthenticated, the user's Claude session has expired. Tell them to run `claude` interactively once to sign back in.

## Fix #4 — Rate limited

If the user hit their Claude Max window, `probe_provider` might succeed but the first real call will throw `RateLimitError`. Explain: Claude Max has a rolling 5-hour window; they'll need to wait or switch provider.

## When to suggest switching

If the user is blocked for more than one exchange on install issues, offer: *"Want me to switch you to the Claude API route instead? You'd paste an API key and we're moving again."* — and if they say yes, call `set_provider` with `claude-api`.

Do not keep looping on the CLI. Three strikes and suggest another provider.
