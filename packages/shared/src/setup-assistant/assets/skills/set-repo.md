---
id: set_repo
name: Set GitHub repo (owner/name)
when_to_use: >
  The user has confirmed which repo to work on — either by accepting the
  detected one or by pasting it manually.
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

Writes `git.repo` to `config.yml`.

Validation rules:

- Must match `owner/name` — single slash, alphanumeric + `._-` on either side.
- Do not accept a full URL (`https://github.com/foo/bar`) directly — ask the user to strip it, or do that stripping yourself before calling.
- Case-sensitive is fine; GitHub normalises at their side.

After this action lands, immediately ask for the GitHub PAT in the next `say` — don't call `save_github_token` yet, you need the token from the user first.
