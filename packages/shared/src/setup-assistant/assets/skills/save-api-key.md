---
id: save_api_key
name: Save API key to keychain
when_to_use: >
  An API-key provider (claude-api / claude-max / openai / openrouter) is
  selected, the user has just pasted a key, and you've confirmed it looks
  like a real key (starts with the expected prefix, reasonable length).
input_schema:
  type: object
  additionalProperties: false
  properties:
    provider_id:
      type: string
      enum: [claude-api, claude-max, openai, openrouter]
    secret:
      type: string
      minLength: 10
      description: >
        The raw API key the user provided. The runtime writes it to the OS
        keychain and discards it — do NOT echo it back or repeat it in `say`.
  required: [provider_id, secret]
---

# save_api_key

Stores the API key in the OS keychain via `keytar`. The account name is derived from the provider:

| Provider | Keychain account |
|---|---|
| `claude-api`, `claude-max` | `anthropic-api-key` |
| `openai` | `openai-api-key` |
| `openrouter` | `openrouter-api-key` |

**Security rules you must follow:**

1. **Never** include the key value in your `say` field. Use masking: `sk_…9a2f` if you must reference it.
2. **Never** write the key to `config.yml` — that's why this goes through `keytar`.
3. If the key looks malformed (wrong prefix, under 10 chars), refuse: reply without an action and ask the user to re-paste.
4. If `keytar` isn't available (the action will throw "Could not write to OS keychain…"), tell the user to export `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` in their shell instead, and advance the conversation as if saved.

Expected prefixes (soft check, not authoritative):

- `sk-ant-…` — Anthropic
- `sk-…` — OpenAI
- `sk-or-…` — OpenRouter
