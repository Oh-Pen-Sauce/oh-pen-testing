---
id: set_model
name: Change the AI model
when_to_use: >
  The user wants to switch which model the current provider uses. Works
  both during setup (rare — default is fine) and after setup as a
  runtime adjustment. Typical asks: "switch to opus", "use the cheaper
  model", "change from sonnet to opus 4.7", "I need more reasoning
  power, what's the most capable?".
input_schema:
  type: object
  additionalProperties: false
  properties:
    model:
      type: string
      minLength: 3
      description: >
        Exact model id to persist to `ai.model` in config.yml. Must be
        one of the ids listed for the current provider in the model
        catalog (see the catalog below), or a provider-native identifier
        the user explicitly supplied (Ollama users often pull custom
        models — honour whatever they paste).
  required: [model]
---

# set_model

Writes `ai.model` in `config.yml`. The provider itself doesn't change —
only which specific model within that provider's catalog is used on the
next call.

## When a user asks informally

Map fuzzy phrasing to exact ids:

| User says | Emit id |
|---|---|
| "switch to opus" / "use opus" | `claude-opus-4-7` (Claude family) or `anthropic/claude-opus-4.7` (OpenRouter) |
| "switch to sonnet" / "back to sonnet" | `claude-sonnet-4-6` |
| "use the cheap one" / "haiku" | `claude-haiku-4-5` |
| "the reasoning model" (OpenAI) | `o1` |
| "a smaller model" (Ollama) | `phi3.5:3.8b` |
| "more ram" / "bigger brain" (Ollama) | `deepseek-coder-v2:16b` |

If the user asks for something you're not sure about ("can we use 4.5?"),
ask rather than guess.

## Catalog (by provider)

**Claude (API or CLI):**
- `claude-opus-4-7` — most capable, highest cost
- `claude-sonnet-4-6` — balanced default
- `claude-haiku-4-5` — fastest + cheapest

**OpenAI:**
- `gpt-4o` — flagship multimodal
- `gpt-4o-mini` — cheap and fast
- `o1` — reasoning model (slower, better on complex scans)
- `o1-mini` — cheaper reasoning

**OpenRouter** (use the `provider/model` form):
- `anthropic/claude-sonnet-4.6`
- `anthropic/claude-opus-4.7`
- `openai/gpt-4o`
- `openai/gpt-4o-mini`

**Ollama** (local, user-chosen — accept any string the user pasted):
- `kimi-k2.6` (default)
- `llama3.1:8b`
- `deepseek-coder-v2:16b`
- `phi3.5:3.8b`
- Or any custom tag the user has pulled (`ollama list` to see what they have)

## After the action lands

Confirm in one line. Example:

> *"Switched to Opus 4.7. Next scan will use it."*

Do **not** trigger a scan automatically — just persist the choice.

## Constraints

- Never call `set_model` with a provider from a different family than
  what's currently selected (e.g. don't set `gpt-4o` while the
  provider is `claude-api`). If the user's ask implies switching
  provider too, call `set_provider` FIRST, wait for that to confirm,
  then call `set_model` in the next turn.
- Don't echo the same model id the config already has — no-op asks
  like "use sonnet" when sonnet is already selected should get a
  "you're already on sonnet" reply with `action: null`.
