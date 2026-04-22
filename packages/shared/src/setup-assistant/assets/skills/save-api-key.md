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

Stores the API key in the OS keychain via `keytar`. The account name is
derived from the provider:

| Provider | Keychain account | Env var fallback |
|---|---|---|
| `claude-api`, `claude-max` | `anthropic-api-key` | `ANTHROPIC_API_KEY` |
| `openai` | `openai-api-key` | `OPENAI_API_KEY` |
| `openrouter` | `openrouter-api-key` | `OPENROUTER_API_KEY` |

---

## Walkthrough — how the user gets an API key

Offer this proactively when the user arrives at the `credentials` step,
**before** they ask "where do I get one?". The copy below is indicative;
adapt to the provider they actually picked.

### Anthropic (Claude API)

1. Sign in at **[console.anthropic.com](https://console.anthropic.com)**.
2. If it's a fresh account, add a payment method first (Settings → Billing). Anthropic won't issue usable keys on an account with zero billing set up — they'll issue keys but every call will 402.
3. Go to **[console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)**.
4. Click **Create Key**, give it a name like `oh-pen-testing`.
5. Copy the key — starts with `sk-ant-…`. Paste it back to me.
6. Anthropic will not show it again.

**Cost check:** Claude Sonnet 4.6 runs ~$3 / million input tokens, ~$15 / million output. A typical scan uses well under 100k tokens. Set a monthly cap at [console.anthropic.com/settings/limits](https://console.anthropic.com/settings/limits) for peace of mind.

### OpenAI

1. **[platform.openai.com/api-keys](https://platform.openai.com/api-keys)** (sign in first).
2. If a fresh account, add credits: **[platform.openai.com/account/billing](https://platform.openai.com/account/billing)** → Add to credit balance. The free tier doesn't cover GPT-4-class models.
3. **Create new secret key** → give it a name → optionally restrict it to specific projects.
4. Copy the key — starts with `sk-…`. Paste it back.

### OpenRouter

OpenRouter is a gateway that lets you pick from dozens of models using
one key. Useful if you want to A/B providers without swapping configs.

1. Sign in at **[openrouter.ai](https://openrouter.ai)**.
2. Add credits at **[openrouter.ai/credits](https://openrouter.ai/credits)** (they support Stripe + crypto).
3. Go to **[openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)** → **Create Key**.
4. Copy — starts with `sk-or-…`. Paste it back.
5. Cheapest good-enough models right now: `anthropic/claude-sonnet-4.6` or `openai/gpt-4o-mini`. We can change the model later in Settings.

### Claude Max (the user's Anthropic subscription)

This is the "I already pay $20/mo for Claude, can I use that" route. It
still needs an API key — the Max plan doesn't expose session cookies
for third-party tools. Follow the Anthropic steps above.

If the user has no interest in paying per token, suggest **Claude Code
CLI** (via `set_provider`) — it rides their Max subscription directly
via the local `claude` binary.

---

## Security rules (hard rules — never break)

1. **Never** include the key value in your `say` field. Use masking: `sk-ant-…9a2f` if you must reference it.
2. **Never** write the key to `config.yml` — secrets go through the three-tier store (keychain → `~/.ohpentesting/secrets.json` → env).
3. If the key looks malformed (wrong prefix, under 10 chars), refuse: reply without an action and ask the user to re-paste.
4. The action returns `{ location, detail }`. `location` is `"keychain"` or `"file"` — relay it in your confirmation bubble so the user knows where their key ended up. Example: *"Saved to your OS keychain 🔐"* or *"Saved to `~/.ohpentesting/secrets.json` (0600, user-only)."*

Expected prefixes (soft check — just to catch typos):

- `sk-ant-…` — Anthropic
- `sk-…`      — OpenAI (also `sk-proj-…` for project-scoped keys)
- `sk-or-…`   — OpenRouter

## Common failures

**"The key won't save."**
The action is resilient — if the OS keychain refuses (common on
Linux without `libsecret`), the runtime falls back to
`~/.ohpentesting/secrets.json` (mode 0600, user-only, never inside a
repo). The user does not need to `export` anything. If the action
still throws, the most common cause is a genuinely malformed key —
re-copy from the provider's console and try once more.

**"I pasted but Oh Pen Testing says invalid key later."**
Usually the key was truncated — some paste buffers drop trailing
characters on keys that contain underscores or hyphens. Ask them to
re-copy from the provider's console and re-paste.

**"I'm nervous about pasting a secret in a chat."**
Reassure: *"The string doesn't leave your machine. It goes straight to
your OS keychain, or a user-only file if the keychain isn't available.
The chat transcript doesn't persist it."* If they're still uncomfortable,
they can set the matching env var before launching the app and we'll
pick it up automatically.
