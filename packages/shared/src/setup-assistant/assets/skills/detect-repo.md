---
id: detect_repo
name: Detect GitHub repo from local git
when_to_use: >
  You're at the GitHub step and want to spare the user a copy-paste. Call
  this before asking for repo owner/name.
input_schema:
  type: object
  additionalProperties: false
  properties: {}
---

# detect_repo

Shells out to `git remote get-url origin` in the project cwd and parses it into `owner/name`.

**Supported remote URL formats** (non-exhaustive):

```
https://github.com/owner/name.git
git@github.com:owner/name.git
https://github.com/owner/name
ssh://git@github.com/owner/name.git
```

The runtime returns one of:

- `{ ok: true, repo: "owner/name" }` — offer it to the user, then call `set_repo` only after they confirm (say, `"I see this lives at oh-pen-sauce/oh-pen-testing — want me to use that?"`).
- `{ ok: false, reason: "not a git repo" }` — the cwd isn't under git. Ask the user to paste `owner/name` manually.
- `{ ok: false, reason: "no origin remote" }` — git repo exists but no remote. Same fallback.
- `{ ok: false, reason: "non-github remote" }` — remote is GitLab/Bitbucket/something. Tell the user Oh Pen Testing supports GitLab and Bitbucket too (via `git.host` in config) but the wizard focuses on GitHub for now.

Do not auto-commit a detected repo without the user's ack. The user might have cloned a fork and want to point at a different remote.
