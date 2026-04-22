---
id: save_github_token
name: Save GitHub PAT to keychain
when_to_use: >
  The user just pasted a GitHub personal access token. Only call this once
  you've confirmed the token looks like a PAT (starts with ghp_ or github_pat_).
input_schema:
  type: object
  additionalProperties: false
  properties:
    secret:
      type: string
      minLength: 20
      description: >
        The raw token. Never echo back in your `say`.
  required: [secret]
---

# save_github_token

Stores the token in the OS keychain under account `github-token`.

---

## Walkthrough — how the user creates a PAT

A huge chunk of first-time users have never created a Personal Access
Token before. When you ask for one, assume the user is staring at a
blank chat bubble thinking "what even is that?" and offer the
walkthrough proactively — don't wait for them to ask.

There are two kinds of PAT on GitHub. **Recommend the fine-grained flow
first** — it's narrower and safer.

### Option A — Fine-grained PAT (recommended)

Scopes exactly one repo. If the token leaks, the blast radius is one
repo.

1. Go to **[github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)**.
2. **Token name** — anything memorable, e.g. `oh-pen-testing / <repo-name>`.
3. **Expiration** — 90 days is a healthy default. Calendar reminder for yourself.
4. **Resource owner** — your personal account, or the org that owns the repo.
5. **Repository access** — choose *"Only select repositories"* and pick the one repo you're setting up.
6. **Permissions** — under *Repository permissions*, set:
   - **Contents** → **Read and write**
   - **Pull requests** → **Read and write**
   - **Metadata** → **Read-only** *(GitHub sets this automatically — leave it)*
   - Everything else: *No access*.
7. Click **Generate token**.
8. **Copy the token immediately** — it starts with `github_pat_…`. GitHub won't show it again.
9. Paste it back to me.

### Option B — Classic PAT

Only use this if the repo is in an org that doesn't yet support
fine-grained tokens.

1. Go to **[github.com/settings/tokens/new](https://github.com/settings/tokens/new)**.
2. **Note** — `oh-pen-testing / <repo-name>`.
3. **Expiration** — 90 days.
4. **Scopes** — check:
   - `repo` (the whole block — includes `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`, `security_events`)
5. Click **Generate token**. The token starts with `ghp_…`. Copy it.
6. Paste it back to me.

### After paste

- Call `save_github_token` with the raw string the user pasted.
- The runtime writes it to the OS keychain under account `github-token`.
- Do NOT repeat the token value in your `say`. Mask it: `ghp_…9a2f`.

---

## Common failures and what to say

**"I don't see 'Fine-grained tokens' in my GitHub sidebar."**
Some old GitHub accounts need to opt in first. Tell them: *"Go to
[github.com/settings/tokens](https://github.com/settings/tokens), you
may see only the classic view. Click 'Fine-grained tokens' in the
sidebar — if it's not there, fall back to Option B above."*

**"I already have a PAT — can I reuse it?"**
Only if the scopes include `repo` (classic) or Contents+Pull-requests
(fine-grained) for *this* repo. Safer to make a new, narrow one.

**"I pasted but it looks wrong."**
Ninety percent of the time the user double-clicked and got a trailing
space. Ask them to re-paste and trim. The form should strip whitespace
but belt-and-braces.

**"GitHub says my token is rejected."**
Four things to check, in order:
1. **Expiration** — GitHub defaults PATs to short lifetimes (30/60/90
   days). If it's over a month old, probably expired.
2. **Repo access** — for a fine-grained token, *"Only select
   repositories"* must include this exact repo.
3. **Permissions** — Contents and Pull-requests both need Read+Write.
   Read-only won't work for PR creation.
4. **Org SSO** — if the repo belongs to an SSO-enforced org, the token
   needs to be *authorised* for that org separately. There's a
   *"Configure SSO"* button next to each classic PAT in the list.

**"It still doesn't work and I'm frustrated."**
Don't loop. The save action is resilient by design — if the OS
keychain refuses (common on Linux without libsecret), the runtime
falls back to `~/.ohpentesting/secrets.json` automatically (mode
0600, never inside a repo). The user does not need to `export`
anything manually. The token is kept user-only and is read back the
same way for every git-adapter call. If the save *still* fails, the
most common cause is a genuinely malformed token — ask them to
re-copy it directly from GitHub (no double-click, no trailing
newline) and try once more.

---

## Never

- Never suggest a PAT with `admin:org` or `workflow` scope unless the
  user explicitly needs those (they don't for Oh Pen Testing).
- Never ask for the user's GitHub password. PATs replace passwords here.
- Never log the token. Never echo it. Never include it in `say`.
- Never hand the user a pre-filled URL with query params that would
  expose the value.
