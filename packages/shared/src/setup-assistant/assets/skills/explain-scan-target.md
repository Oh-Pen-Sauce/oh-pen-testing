---
id: explain_scan_target
name: Explain the scan target (cannot be changed at runtime)
when_to_use: >
  The user has asked to "point Oh Pen Testing at a different project",
  "scan a different repo", "change the scan target", or any equivalent.
  You MUST call this skill (which is informational only, action:null)
  rather than calling set_repo — because set_repo changes the PR
  target, not the scan target. Getting this wrong silently runs the
  next scan against the same directory while the user thinks you
  moved it.
input_schema:
  type: object
  additionalProperties: false
  properties: {}
---

# explain_scan_target

This skill has no side-effects. It exists as a guardrail: when the
user asks about changing the scan target, you route here instead of
calling `set_repo`, which is a different thing entirely.

## The two targets

Oh Pen Testing has **two** separate target concepts. Users conflate
them constantly; you must not.

| Concept | What it is | Where it's set | Changeable at runtime? |
|---|---|---|---|
| **Scan target** | The directory the scanner walks | `OHPEN_CWD` env var, or `process.cwd()` the server was launched from | **No.** Requires stopping the server and relaunching from a different dir. |
| **PR target** (`git.repo` in config) | Which GitHub repo agents open PRs against when they land fixes | `config.git.repo` — set via `set_repo` or the Settings form | Yes, via `set_repo`. |

If you call `set_repo` when the user asked to change the scan target,
you've changed nothing the user cares about. Worse: their PRs will
now go to the repo they named (which might not exist, or might
exist but not be where they work). Don't do this.

## What to say

When the user asks to change the scan target, reply honestly:

> *"The scan target is whatever directory Oh Pen Testing was launched
> from — it's hard-wired at server start, I can't change it from
> here. To scan a different project:*
>
> *1. Stop this web server (Ctrl-C in the terminal where you ran
>    `opt setup`).*
> *2. `cd` into the project you want to scan.*
> *3. Run `opt setup` again from there.*
>
> *That'll relaunch with the new folder as the target. Your config
> persists per-project (it lives in each project's .ohpentesting/),
> so you'll do setup once per repo."*
>
> *The banner at the top of every page shows the current scan target
> in monospace — that's the authoritative answer to "what's being
> scanned".*

Set `action: { id: "explain_scan_target", input: {} }` so the UI can
render a "noted" confirmation but no state changes.

## When the user seems to mean PR target instead

Some users say "scan target" when they actually mean "the GitHub repo
the PRs go to". Disambiguation signals:

- "The scan is hitting the wrong code" → they mean scan target. Use
  the walkthrough above.
- "The PRs went to the wrong repo" / "I want the fixes to land on a
  different repo" → they mean PR target. Call `set_repo` in a fresh
  turn with the new slug.
- Ambiguous ("point it at a different project") → ask:
  > *"Two things called 'target' — scan target (which code we read)
  > or PR target (which repo the fixes get pushed to)? They're
  > independent."*

Never guess when it's ambiguous. Asking costs nothing; a wrong
`set_repo` means fixes go to the wrong repo and the user has to
chase them back.
