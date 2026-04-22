---
id: troubleshoot_claude_cli
name: Troubleshoot Claude Code CLI
when_to_use: >
  `probe_provider` for claude-code-cli returned ok:false, or the user is
  trying to install/fix Claude CLI rather than switch providers. This
  skill has no action — it's purely reference content you draw from
  when composing `say`.
input_schema:
  type: object
  additionalProperties: false
  properties: {}
---

# troubleshoot_claude_cli

The detection runs `claude --version`. If that fails, walk the user
through install / PATH / session issues in the order below. Stop after
the first fix that sticks — don't read the whole chapter aloud.

---

## Install, if they don't have it yet

### macOS (easiest path)

```bash
brew install anthropic/claude/claude
```

If the user doesn't have Homebrew, direct them to
**[brew.sh](https://brew.sh)** first (one-line shell install) — or use
the direct download route below.

### Direct download (macOS + Linux + Windows)

1. Go to **[claude.ai/download](https://claude.ai/download)**.
2. Pick their OS, run the installer.
3. Open a new terminal and run `claude --version`. Should print something like `2.1.107 (Claude Code)`.

### Linux via shell installer

```bash
curl -fsSL https://claude.ai/install.sh | sh
```

### After install — sign in once

The first time they run `claude` interactively it'll open a browser for
OAuth. Walk them through:

```bash
claude
```

Sign in, close the browser tab when it says "You can close this window",
quit the `claude` session. Their auth token is now cached.

---

## Already installed but detection fails

Symptom: `probe_provider` returns *"Not found on PATH"* / *"spawn claude ENOENT"*.

### Check 1 — is it actually installed?

Ask the user to run **in the same terminal they launched Oh Pen Testing from**:

```bash
which claude
```

- Prints a path (`/opt/homebrew/bin/claude`, `~/.claude/local/claude`, etc.) → **Go to Check 2.**
- Prints nothing → they don't have it. Go to Install above.

### Check 2 — is Oh Pen Testing's process using the same PATH?

The `next dev` server spawned by an IDE (VS Code, JetBrains) often
inherits a stripped-down PATH that doesn't include Homebrew. The fix
is usually one of:

**Fix A — Run the setup from a terminal, not the IDE.** Close the web
server, open a new terminal in the repo, and run:

```bash
opt connect --provider claude-code-cli
```

The CLI sees the real PATH. It writes the config, and when you reload
the web UI, Marinara picks it up.

**Fix B — Add claude to the web server's PATH.** If the IDE route is
non-negotiable, export the PATH in the shell env the IDE uses:

```bash
export PATH="/opt/homebrew/bin:$PATH"
```

Then restart the IDE so the new PATH propagates.

Note: Oh Pen Testing's detector *does* probe common install locations
(Homebrew, `~/.local/bin`, `~/.claude/local`, `~/.npm-global`, `~/.bun`)
when PATH comes up empty. If detection *still* fails after all that,
the binary is somewhere unusual — ask the user what `which claude`
prints so I can share it with the next step.

### Check 3 — session expired

Symptom: `claude --version` works, but the provider throws during a
real completion call.

```bash
claude
```

Sign back in when it prompts. Their cached token has aged out — Claude
Max sessions roll over every few weeks.

### Check 4 — rate limited

Claude Max has a rolling 5-hour window (~45 messages for Sonnet). If
the user is right at the cap, the CLI will reply but Oh Pen Testing
will see a RateLimitError on the first call.

Options:
- Wait for the window to roll (an hour usually frees some capacity).
- Switch to the Claude API route temporarily.

---

## When to stop troubleshooting

Three strikes and pivot. If the user is still blocked after three
exchanges about Claude CLI, offer:

> *"Want me to switch you to the Claude API route? Paste an API key and we're moving in two minutes."*

and if they agree, call `set_provider` with `claude-api` and continue.
Onboarding fatigue is a real user-loss risk.
