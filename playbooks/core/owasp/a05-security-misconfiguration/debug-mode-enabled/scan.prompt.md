## Playbook: debug-mode-enabled (scan)

Confirm when the debug flag is set unconditionally (literal True) in a settings file or entry point that clearly ships to production.

Do NOT confirm when:
- The flag is behind an `if DEBUG:` / env gate (`DEBUG = os.environ.get("DEBUG", "").lower() == "true"`).
- The file is under `tests/`, `settings/development.py`, or similar dev-scoped paths.

Severity:
- `critical` — Django DEBUG=True with ALLOWED_HOSTS configured for production.
- `high` — debug flag unconditionally True in main app file.
- `medium` — error handler returns stack traces to clients.
