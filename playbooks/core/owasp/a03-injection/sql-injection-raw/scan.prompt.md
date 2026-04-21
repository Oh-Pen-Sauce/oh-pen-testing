## Playbook: sql-injection-raw (scan)

Confirm when the interpolated value could be user-controlled (traced or plausibly from request input, file input, or an untrusted producer).

Do NOT confirm when:
- The interpolated value is a compile-time constant (a local literal, a static enum, a known column whitelist).
- Interpolation is explicitly of a table/column identifier that can't be parameterised, AND the identifier is allowlist-validated upstream.

Severity:
- `critical` — directly uses request param/body/query.
- `high` — uses a value transitively derived from request input.
- `medium` — plausibly user-controlled but the trace is ambiguous.
- `low` — likely a false positive (flag for review).
