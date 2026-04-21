## Playbook: xxe-vulnerable-parser (scan)

Confirm when:
- Parser is used on XML payloads from HTTP requests, uploads, or external APIs.
- Entity / DTD resolution isn't explicitly disabled.

Do NOT confirm when:
- The XML source is a known internal static file bundled with the application and never read from untrusted input.
- The parser is already configured with entity resolution off (setFeature, resolve_entities=False, no_network=True).

Severity:
- `critical` — parser fed with user-uploaded XML.
- `high` — parser fed with XML from a less-trusted upstream API.
- `medium` — ambiguous source.
