---
id: set_repo
name: Set PR target GitHub repo (owner/name)
when_to_use: >
  The user has confirmed which repo PRs should go to — either by
  accepting the detected origin or by explicitly overriding it with a
  full acknowledgement that they're choosing a different repo than the
  scan folder's origin. This is the PR target, NOT the scan target.
  See the "two targets" table in memory.md.
input_schema:
  type: object
  additionalProperties: false
  properties:
    repo:
      type: string
      pattern: "^[\\w.-]+/[\\w.-]+$"
      description: "GitHub repo slug in owner/name format (e.g. oh-pen-sauce/oh-pen-testing)."
  required: [repo]
---

# set_repo

Writes `git.repo` to `config.yml`. This is the **PR target** — where
agents open pull requests when they land fixes. It is NOT the scan
target (that's cwd, fixed at server start; see `explain_scan_target`).

## Pre-flight: check the cwd's origin first

Before calling `set_repo`, you should usually have already called
`detect_repo` and either:

1. Gotten a matching origin → the value the user confirmed matches
   the scan folder. Safe, the common case, just call `set_repo`.
2. Gotten a non-matching origin → the user is deliberately aiming at
   a different repo than the one being scanned. **This is a red
   flag.** See the "Mismatch handling" section below.
3. Gotten no origin (not a git repo, non-GitHub remote) → call
   `set_repo` with whatever the user typed; they know something we
   don't.

## Validation rules

- Must match `owner/name` — single slash, alphanumeric + `._-` on either side.
- Do not accept a full URL (`https://github.com/foo/bar`) directly — ask the user to strip it, or do that stripping yourself before calling.
- Case-sensitive is fine; GitHub normalises at their side.

## Mismatch handling (hard rule)

If the user pastes `owner/name` that differs from what
`detect_repo` returned, **do not immediately call `set_repo`**.
Reply first with a confirmation bubble:

> "Heads up — the folder I'm scanning has git origin
> `<detected>`, but you said `<user-pasted>`. If I set the PR
> target to `<user-pasted>`, PRs will open on a repo I'm not reading
> code from. That's legitimate for fork → upstream flows, but it's
> usually a mistake. Still go with `<user-pasted>`?"
> `action: null`

Only after the user explicitly re-confirms the override do you call
`set_repo`. If they say "no" or "use the detected one", call
`set_repo` with the detected value instead.

## After this action lands

Immediately ask for the GitHub PAT in the next `say` — don't call
`save_github_token` yet, you need the token from the user first.
