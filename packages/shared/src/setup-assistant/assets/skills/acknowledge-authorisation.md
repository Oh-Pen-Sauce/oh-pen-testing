---
id: acknowledge_authorisation
name: Acknowledge testing authorisation (HARD GATE)
when_to_use: >
  The user has explicitly confirmed they are authorised to run pen-tests
  against this codebase AND given you their name. This is the only action
  that completes setup.
input_schema:
  type: object
  additionalProperties: false
  properties:
    actor_name:
      type: string
      minLength: 2
      description: >
        The human name of the person acknowledging. Pass what the user
        typed verbatim (e.g. "Sam Nash", "sam", "Dr. Kim Lee").
  required: [actor_name]
---

# acknowledge_authorisation

Writes `scope.authorisation_acknowledged: true` with `authorisation_acknowledged_by: <name>` and `authorisation_acknowledged_at: <now>` to `config.yml`.

## Why this is a hard gate — and how to explain it

Oh Pen Testing is *authorised-testing-only* software. Pen-testing without
authorisation is potentially illegal (Computer Fraud and Abuse Act in
the US; the Computer Misuse Act in the UK; similar laws elsewhere).
This flag exists so that every scan record carries a named owner who
said "I'm allowed to test this".

When the user arrives at this step, open with a short explanation so
they know exactly what they're saying yes to. Template:

> *"Before I can start scanning, I need you to confirm you have
> permission to test this codebase. 'Yes' means one of:*
> - *you own the code personally, OR*
> - *your employer owns it and your role includes security testing, OR*
> - *you have explicit written permission from the owner to run
>   security tests against it.*
>
> *If none of those are true, stop here and get written permission
> first — running pen-tests without it is illegal in most places. Type
> your name if you're good to proceed, or 'skip' if not."*

If the user shows any sign of uncertainty ("I think so?", "probably?",
"not sure if this counts"), **do not take a name as acknowledgement**.
Say instead:

> *"Let's pause. If there's any doubt about authorisation, the right
> move is to get something in writing before we start. We can come
> back here once you do."*

Then reply with `action: null` — leave the setup unfinished rather than
land a shaky ack.

**You must not call this action unless ALL of these are true:**

1. The user has explicitly said they own the code, or have written permission to test it.
2. The user has given you a name (their name, not yours, not "chef", not "anon").
3. The user has not said "I'm not sure" or "I don't know if I'm allowed" anywhere in the conversation.

If the user is unsure, **do not acknowledge on their behalf.** Say something like: *"Only check this box if you actually own the repo or have written permission. If you're unsure, skip it — we can come back later."*

## The name

- Trim leading/trailing whitespace before passing as `actor_name`.
- Do not accept single-character names or obvious sentinels ("x", "na", "test", "anon").
- Do not accept your own name. If the user says "Marinara", reply *"Nice try 🍅 — I need your name for the record."*

## After success

This is the last required step. Reply with a single closing bubble:

> *"Kitchen's open. Wanna run your first scan?"*

…and set `action: null`. The UI will swap in CTA buttons.
