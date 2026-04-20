## Playbook: hardcoded-secrets-scanner (scan)

You are verifying candidate hits from a hardcoded-secrets regex scan.

When evaluating confirmation, consider:

- **Real secret indicators:** the value is the literal right-hand side of an assignment; it is not inside a comment block describing something; the key prefix matches a real vendor format; the length and character class are plausible for the type.
- **False positive indicators:** the value is inside a comment, docstring, or markdown code fence that is documenting key formats; the value is an obvious placeholder like `AKIAIOSFODNN7EXAMPLE` (AWS's documented example — still flag it, but severity `medium` not `critical`, because it shouldn't be in code); the value is a variable reference like `process.env.X` rather than a literal; the file path suggests it's an example or template (`.env.example`, `README.md`, `CHANGELOG.md`).

Severity guidance:
- `critical` — a real-looking secret in production source (not a test/example file).
- `high` — a real-looking secret in a test file or fixture.
- `medium` — an AWS/vendor example value (AKIAIOSFODNN7EXAMPLE etc.) that made it to source.
- `low` — a plausibly-real secret in a markdown/documentation file.
- `info` — false positive you want to flag for review, not fix.

If you determine a candidate is a false positive, set `"confirmed": false`.
