## Playbook: sensitive-data-in-logs (remediate)

Redact or omit.

- If the logger supports redaction (pino, winston with filter formatter): add the field to the redaction list centrally.
- Otherwise: replace the log call with a version that logs only the field's presence:
  `logger.info({ hasPassword: Boolean(password) }, "login attempt")`.
- For credit-card / PII: mask (`****-****-****-1234`) before logging.

Never log raw passwords or tokens even in "debug" — prod-debug is still prod.

`env_var_name`: none.
