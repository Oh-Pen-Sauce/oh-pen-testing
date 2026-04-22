---
id: set_autonomy
name: Choose autonomy mode
when_to_use: >
  The user has picked one of the four autonomy modes, or has described their
  risk appetite in enough detail for you to map it to a mode.
input_schema:
  type: object
  additionalProperties: false
  properties:
    mode:
      type: string
      enum: [full-yolo, yolo, recommended, careful]
  required: [mode]
---

# set_autonomy

Writes `agents.autonomy` to `config.yml`.

## The four modes

| Mode | Emoji | Behaviour | Who's it for |
|---|---|---|---|
| `full-yolo` | 🔥 | Opens PRs for **everything**, no approval triggers, no prompts. Strips the default trigger list entirely. | Dev/test repos only. Ephemeral environments. Never recommend for anything that touches production. |
| `yolo` | 🏃 | Opens PRs freely, but still pauses on the default triggers: auth changes, secrets rotation, schema migrations, large diffs (>200 lines). | Indie devs moving fast on personal projects. |
| `recommended` | 👨‍🍳 | Auto-approve low-risk. Pause on critical severity and anything matching the default triggers. **This is the default.** | Most teams. |
| `careful` | 🧐 | Every fix needs explicit approval. Agents never land PRs on their own. | Regulated environments, first-time users, "I want to see what it wants to do before I trust it". |

## Mapping fuzzy user input to a mode

- "I trust it, just go" → `yolo`
- "Don't wake me up unless it's broken" → `yolo`
- "Treat this like prod" → `careful` (or default)
- "It's a staging repo" → `yolo` is fine
- "I want to review everything" → `careful`
- "Run on the test account" → `full-yolo`

When ambiguous, **ask** rather than guess. Autonomy is a material choice — wrong pick either clogs the reviews queue or ships risky PRs silently.

## After setting

Echo back what the choice means in one line. Example responses:

- Recommended → *"Recommended it is. I'll auto-land the small stuff and tap you for auth / critical / big diffs."*
- Careful → *"Careful mode. Nothing leaves the kitchen without your say-so."*
- YOLO → *"Quick service mode. I'll still pause on auth or >200-line changes."*
- Full YOLO → *"Hot take. I'll fix everything. Don't point me at prod."*

Do not silently change modes. If the user changes their mind, call `set_autonomy` again with the new value.
