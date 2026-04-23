---
id: clone_and_activate_project
name: Clone or register a GitHub repo and make it the scan target
when_to_use: >
  The user has confirmed which GitHub repo Oh Pen Testing should work
  with during setup. Use this INSTEAD of `set_repo` when you're
  onboarding a fresh project — it handles the full "clone → scaffold
  → carry over provider settings → register as managed project →
  make active" flow in one step, so the rest of the wizard persists
  to the new project's config. Use plain `set_repo` only when the
  user has already opted out of the managed-projects model and is
  launching Oh Pen Testing manually from a different dir.
input_schema:
  type: object
  additionalProperties: false
  properties:
    slug:
      type: string
      pattern: "^[\\w.-]+/[\\w.-]+$"
      description: "GitHub repo slug in owner/name format."
    existing_local_path:
      type: string
      description: >
        Absolute filesystem path to an already-cloned copy of the
        repo. When provided, the skill registers this path instead of
        cloning fresh. Leave empty to let the runtime clone the repo
        to ~/.ohpentesting/projects/<owner>/<name>/.
  required: [slug]
---

# clone_and_activate_project

Binds the rest of the setup wizard (autonomy, authorisation, future
scans) to a specific GitHub project. Replaces the old `set_repo` in
the onboarding happy path.

## What the runtime does on confirmation

1. **Fetches** the GitHub PAT from the secrets store (if one was
   saved earlier in setup). Public repos don't need it.
2. **Clones OR validates an existing path**:
   - Fresh clone: `git clone --depth=1` into
     `~/.ohpentesting/projects/<owner>/<name>/`. Auth via the PAT
     embedded once in the URL, then scrubbed from `.git/config`
     after clone (no long-lived plaintext on disk).
   - Existing path: checks the path exists and has a `.git/`
     subdir. No clone happens.
3. **Scaffolds** `.ohpentesting/` inside the clone directory if one
   doesn't already exist — so config / issues / scans / logs land
   next to the cloned source.
4. **Carries over in-progress config**: reads whatever's already in
   the current scan-target's config (provider id, model, rate-limit
   settings, telemetry toggle) and copies those fields into the
   newly-scaffolded config. The user doesn't lose the provider
   choice they already made earlier in the wizard.
5. **Writes `git.repo`** on the new config to `<slug>`.
6. **Registers** the project in the managed-projects registry
   (`~/.ohpentesting/projects.json`) and **marks it active**. From
   this point forward, every server action — remaining wizard
   steps, scans, reports — reads from and writes to the NEW
   clone's `.ohpentesting/`.

## Two questions to ask BEFORE calling

First turn — if `detect_repo` hasn't run yet: call that first. If
the user's cwd has a git origin matching the slug they gave, the
"I already have this cloned" path is obviously available.

Second turn — ask the user **which mode**:

> "Two ways to wire this up:
>
> 1. **Clone it locally** — I'll make a fresh shallow clone at
>    `~/.ohpentesting/projects/<owner>/<name>/`. Takes about 30
>    seconds depending on the repo size. Recommended if you don't
>    already have this repo checked out somewhere.
>
> 2. **Point at an existing clone** — if you already have
>    `<owner>/<name>` checked out somewhere on your machine,
>    paste the absolute path and I'll use that directly. No
>    network call.
>
> Which one?"

If the user picks option 1, call this skill with `{ slug }`.
If they pick option 2, call with `{ slug, existing_local_path }`.

## Mismatch rule (same as set_repo)

If `detect_repo` returned one slug but the user asked to clone a
different slug, warn first — same two-turn confirmation flow as in
the `set_repo` skill's body. Don't silently misalign.

## After it lands

Reply in one short bubble acknowledging the change and teeing up the
PAT step:

> "Locked in. <owner/name> is the active project — everything from
> here lands on it. Paste a PAT so I can open PRs there?"

Do NOT call `save_github_token` yet; you still need the user to
paste the token first.

## If cloning fails

The action returns `ok: false` with the git error verbatim. Common
causes:

- **Repo doesn't exist / private + no valid PAT** → re-ask for a
  PAT with `repo` scope, or verify the slug is right.
- **Path already exists but isn't a git repo** → the user has an
  unrelated directory at the clone target. Suggest a different
  slug or ask them to move/delete the conflicting dir.

Echo the error back in a single bubble; don't loop. If the user
wants to try again, they'll say so.
