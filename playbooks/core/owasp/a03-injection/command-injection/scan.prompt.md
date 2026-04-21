## Playbook: command-injection (scan)

Confirm when the interpolated/concatenated value is user-controlled and `shell: true` (or `os.system`, `exec` string form) is used.

Do NOT confirm when:
- The interpolated value is a compile-time constant (path from config, known binary location, static flag).
- `execFile`/`spawn` with args array is used — the shell isn't invoked.
- The value is validated against a strict allowlist upstream and the allowlist is visible in context.

Severity:
- `critical` — directly shells out with request param.
- `high` — interpolates file path / filename from user input.
- `medium` — validation exists but is weak (e.g. just checks non-empty).
