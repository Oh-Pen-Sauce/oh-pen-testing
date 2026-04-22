---
id: set_provider
name: Change AI provider
when_to_use: >
  The user wants to switch to a different AI backend — usually after a failed
  probe, or because they'd rather use Claude CLI instead of an API key.
input_schema:
  type: object
  additionalProperties: false
  properties:
    provider_id:
      type: string
      enum: [claude-api, claude-max, claude-code-cli, openai, openrouter, ollama]
    model:
      type: string
      description: >
        Optional model override — only pass this if the user asked for a
        specific model. Otherwise leave undefined and the default for the
        provider will be used.
  required: [provider_id]
---

# set_provider

Writes `ai.primary_provider` and (optionally) `ai.model` to `config.yml`.

**When to prefer Claude Code CLI** — it rides the user's existing Claude subscription, no per-token billing. Best default for anyone who already has `claude` installed.

**When to prefer Claude API / OpenAI** — the user is running on CI where a local session won't exist. They'll need to paste an API key.

**When to prefer Ollama** — air-gapped / privacy-critical / "my lawyer won't let my code leave the machine". Slower, less accurate, but real.

After setting the provider, the runtime will route to the credentials step if it needs an API key, or skip directly to GitHub if the provider is session-based (CLI) or local (Ollama).
