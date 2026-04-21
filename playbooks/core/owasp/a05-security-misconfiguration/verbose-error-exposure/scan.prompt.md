## Playbook: verbose-error-exposure (scan)

Confirm when the response contains stack traces, full exception representations, or internal details that help attackers map the system.

Do NOT confirm when:
- The response only exposes safe fields like a short error code or user-facing message.
- The exposure is gated by `if DEBUG / process.env.NODE_ENV === "development"`.

Severity:
- `high` — stack traces returned to authenticated-or-public users.
- `medium` — error messages revealing internal file paths, package versions.
- `low` — generic error message, just missing ID.
