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

**Required PAT scopes** (fine-grained or classic, as long as these permissions are present):

- `repo` (read + write to code + commit statuses)
- `pull_requests` (create, update, comment)
- `contents` (read + write)

The narrower alternative is a fine-grained token scoped to a single repository with "Contents: read and write" and "Pull requests: read and write". Recommend this when the user expresses concern about blast radius.

**If the user says the save "didn't work":**

1. Check the PAT didn't expire (GitHub defaults PATs to 30–90 days).
2. Verify they didn't paste the token with a trailing newline — the form should strip it, but belt-and-braces.
3. If `keytar` is broken on their OS, offer: `export GITHUB_TOKEN="ghp_…"` in their shell; Oh Pen Testing's adapters fall back to that env var.

Never echo the raw token. Mask when referring to it (`ghp_…9a2f`).
