# Provider setup

Oh Pen Testing works with any of five AI backends. `opt init` auto-detects the best-available and writes the right default to `config.yml`. Override any time by editing `ai.primary_provider`.

## Claude Code CLI (recommended for Max-plan users)

**Zero extra cost on Claude Max.** Uses your local OAuth session, no API key involved.

Prerequisite: Claude Code CLI installed and logged in (`claude --version` works).

```yaml
# .ohpentesting/config.yml
ai:
  primary_provider: claude-code-cli
  model: claude-sonnet-4-6   # CLI picks its own router model internally
```

## Claude API

Pay-per-token. Best quality, no Max-plan requirement.

```bash
export ANTHROPIC_API_KEY=sk-ant-…
# or keychain:
security add-generic-password -s oh-pen-testing -a anthropic-api-key -w
```

```yaml
ai:
  primary_provider: claude-api
  model: claude-opus-4-7
  rate_limit:
    strategy: auto
    budget_usd: 5.00   # soft cap at 50%, hard cap at 100%
```

## Ollama (fully local, free, offline)

Great for sensitive code you don't want hitting any external API.

```bash
brew install ollama
ollama serve &
ollama pull kimi-k2.6
```

```yaml
ai:
  primary_provider: ollama
  model: kimi-k2.6
```

Smaller models like `qwen2.5-coder:3b` work on tighter hardware but produce noisier confirmations.

## OpenAI / OpenRouter (coming in M2 of the provider-expansion effort)

Schema is already wired (`primary_provider: openai` / `openrouter`); actual providers are stubbed to throw "coming soon" until the M2 provider-expansion ships. The AIProvider interface is stable so adding these is a small PR.

## Choosing a model

| Provider | Default | When to change |
|---|---|---|
| `claude-api` | `claude-opus-4-7` | Switch to `claude-sonnet-4-6` if you're cost-conscious (~5x cheaper, ~same quality for scan-confirm tasks) |
| `claude-code-cli` | `claude-sonnet-4-6` | The CLI does its own routing — this value is a display hint |
| `ollama` | `kimi-k2.6` | Try `qwen2.5-coder` or `llama3.3:70b` if you have the VRAM |

## Rate limits

Oh Pen Testing halts a scan when the provider signals exhaustion — no surprise bills.

- **API-key providers** (Anthropic, OpenAI): token-accounting against `ai.rate_limit.budget_usd`. Soft warning at 50%, hard halt at 100%.
- **Session-window providers** (Claude Max via Claude Code CLI): tracks the rolling 5-hour window; halts at 90% of your session cap.
- **Local providers** (Ollama): no limits, ever.

Halted scans write a partial scan file with `status: "failed"` and the usage snapshot — you can rerun once your window resets.

## Credentials — where they live

Every provider reads credentials in this order:

1. Environment variable (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GITHUB_TOKEN`)
2. OS keychain via `keytar` (macOS Keychain, Windows Credential Manager, libsecret on Linux)
3. **Never from `config.yml`** — the pre-commit hook installed by `opt init` blocks committing `.ohpentesting/credentials*` files.

The setup wizard at `http://127.0.0.1:7676/setup` writes to keychain via a server action. The CLI reads the same store.

## Switching providers mid-scan

```bash
opt scan --provider ollama        # one-shot override
```

Doesn't change `config.yml`. Useful for re-running a scan with a different model to compare results.
