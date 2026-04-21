## Playbook: metadata-service-access (scan)

Confirm when:
- The code intentionally calls a cloud metadata endpoint from application code (should almost always use the cloud SDK's credential provider instead).
- The hostname/IP appears in an allowlist that includes the metadata service — a forwarder that lets attackers reach it.

Do NOT confirm when:
- The IP appears only in a comment documenting a block / deny rule.
- It's in a test fixture explicitly testing SSRF defences.

Severity:
- `critical` — metadata endpoint reachable from SSRF-prone code paths.
- `high` — explicit call to metadata without using IMDSv2.
- `medium` — hostname appears in an ALLOWED_HOSTS-style list (could be a bug).
