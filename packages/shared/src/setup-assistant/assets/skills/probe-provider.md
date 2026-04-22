---
id: probe_provider
name: Probe AI provider
when_to_use: >
  The current step is 'provider' or you want to re-verify connectivity mid-conversation.
  Also call this if the user says 'is the AI connected?' or similar.
input_schema:
  type: object
  additionalProperties: false
  properties:
    provider_id:
      type: string
      enum: [claude-api, claude-max, claude-code-cli, openai, openrouter, ollama]
      description: The provider id to probe.
  required: [provider_id]
---

# probe_provider

Runs the connectivity check for the selected AI provider. This is the same probe the manual form uses — runtime returns a `{ ok, detail }` pair.

**Interpreting results:**

- `ok: true` → reply with a short confirmation ("Ciao — the CLI is connected.") and advance to credentials if it's an API-key provider, or to GitHub if not.
- `ok: false` for `claude-code-cli` → the binary isn't on PATH. Say so; offer the troubleshoot steps (see the `troubleshoot_claude_cli` skill memory).
- `ok: false` for `ollama` → Ollama isn't running on `localhost:11434`. Tell the user to run `ollama serve`.
- `ok: false` for API-key providers → this is unusual because they don't actually ping; if it returns false, report the detail verbatim.

Do **not** call this more than once in a row. If the probe failed, move on to troubleshooting dialogue, not repeated probes.
