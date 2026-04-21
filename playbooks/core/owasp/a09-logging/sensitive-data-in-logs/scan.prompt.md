## Playbook: sensitive-data-in-logs (scan)

Confirm when a real value (not just the field name as a log message) is being written to a log sink.

Do NOT confirm when:
- The log message is describing the absence of the value ("no password provided", "missing api_key").
- A structured logger has explicit redaction configured and the field is in the redaction list.

Severity:
- `critical` — password / access token written to any persistent log.
- `high` — session id / API key.
- `medium` — credit-card number already truncated but still in log.
