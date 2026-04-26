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

- `{ ok: true, repo: "owner/name" }` — offer it to the user, then call `clone_and_activate_project` only after they confirm.
- `{ ok: false, detail: "not a git repo" }` — the cwd isn't under git. Ask the user to paste `owner/name` manually.
- `{ ok: false, detail: "no origin remote" }` — git repo exists but no remote. Same fallback.
- `{ ok: false, detail: "Non-GitHub remote (...)" }` — remote is GitLab/Bitbucket/something. Tell the user Oh Pen Testing supports those too (via `git.host` in config) but the wizard focuses on GitHub for now.
- `{ ok: false, detail: "self-scan: ..." }` — **special case.** The user is running Oh Pen Testing from a clone of OPT's own source repo (most often because they cloned to try the tool). **Do NOT propose oh-pen-sauce/oh-pen-testing as the scan target** — nobody installs a pen-testing tool to scan the pen-testing tool. Instead, say something warm like "looks like you're inside the Oh Pen Testing source itself — that's the tool, not the project you want to scan. What's the GitHub repo you'd like me to actually scan? (paste owner/name and I'll clone it locally for you)" and then route through `clone_and_activate_project` once they answer.

Do not auto-commit a detected repo without the user's ack. The user might have cloned a fork and want to point at a different remote.
