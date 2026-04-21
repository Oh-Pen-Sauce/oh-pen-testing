## Playbook: insecure-deserialization (scan)

Confirm when the deserialised input could be attacker-controlled.

Do NOT confirm when:
- Input comes from a trusted internal file bundled with the application.
- `yaml.load(..., Loader=yaml.SafeLoader)` or `yaml.safe_load` is used.
- `eval` is over a known-literal expression in a test harness.

Severity:
- `critical` — pickle.loads / eval / node-serialize.unserialize on request input.
- `high` — yaml.load without SafeLoader on file input.
