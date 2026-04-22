---
id: troubleshoot_ollama
name: Troubleshoot Ollama
when_to_use: >
  `probe_provider` for ollama returned ok:false, or the user is setting
  up Ollama for the first time. No action — reference content only.
input_schema:
  type: object
  additionalProperties: false
  properties: {}
---

# troubleshoot_ollama

Oh Pen Testing probes `http://127.0.0.1:11434/api/tags`. If that's not
reachable, walk through install + start + model-pull in order.

---

## Install, if they don't have it yet

### macOS

```bash
brew install ollama
```

Or the GUI installer from **[ollama.com/download/mac](https://ollama.com/download/mac)**.

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Systemd service is installed automatically.

### Windows

Download from **[ollama.com/download/windows](https://ollama.com/download/windows)**.

---

## Start the server

The server must be running before Oh Pen Testing can probe it.

### macOS + Linux (foreground)

```bash
ollama serve
```

Leave this terminal open — Ollama runs until you close it. In a
*different* terminal, pull a model (next step).

### macOS + Linux (background, via Homebrew services)

```bash
brew services start ollama
```

Runs on boot from then on.

### Linux (systemd)

```bash
sudo systemctl enable --now ollama
```

### Check it's up

```bash
curl http://127.0.0.1:11434/api/tags
```

If that returns JSON (even empty `{"models":[]}`) the server's healthy.

---

## Pull a model

Oh Pen Testing defaults to `kimi-k2.6`. Pull it once:

```bash
ollama pull kimi-k2.6
```

This downloads ~6 GB — takes a few minutes on fast internet. The
download is one-off; after that the model stays on disk.

Alternatives if `kimi-k2.6` isn't available or too big:

- `llama3.1:8b` — 4.7 GB, solid general model
- `deepseek-coder-v2:16b` — 8.9 GB, best-in-class for code if you have
  the RAM

After pulling, update the model name in config:

```bash
opt connect --provider ollama --model llama3.1:8b
```

…or later via Settings in the web UI.

---

## Common failures

**"Ollama unreachable at http://127.0.0.1:11434"**
The server isn't running. Start it (`ollama serve` or
`brew services start ollama`) and re-probe.

**"Model not found: kimi-k2.6"**
The model isn't pulled. Run `ollama pull <model>` or switch to one
you already have: `ollama list` shows what's on disk.

**"Ollama is running but responses are super slow / OOM'd"**
The machine doesn't have enough free RAM for that model. General
rule: model size on disk ≈ RAM required. A 16 GB Mac struggles with
models over ~7 B parameters. Suggest a smaller model like
`llama3.1:8b` or `phi3.5:3.8b`.

**"I'm on a corporate laptop and I can't install anything."**
Ollama requires local install; there's no hosted option in its model.
Suggest Claude Code CLI (often already installed via the company's
Claude account) or an API-key provider with a team key.

---

## When to stop

If the user's machine genuinely can't run Ollama (too little RAM,
locked-down corporate laptop), pivot to a hosted provider:

> *"Let's switch you to Claude CLI or Claude API — Ollama wants at
> least 8 GB free and a few GB of model on disk, and it sounds like
> this machine isn't set up for that."*

Call `set_provider` with the replacement once the user confirms.
