## Playbook: metadata-service-access (remediate)

Two patterns:

1. **App intentionally accesses metadata** — replace with the cloud SDK's credential provider (AWS SDK's `DefaultCredentialsProvider`, GCP's `google.auth.default`). These handle IMDSv2 / scoped tokens correctly.
2. **Metadata-service IP in an allowlist** — remove it from the list. Add a deny-rule for RFC 1918 + RFC 3927 (link-local 169.254.0.0/16) + known metadata hostnames.

Deny-list blocks (apply to any outbound fetch):
- `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918)
- `127.0.0.0/8` (loopback)
- `169.254.0.0/16` (link-local, including AWS/Azure metadata)
- `fd00::/8`, `fe80::/10` (IPv6 private/link-local)
- hostnames: `metadata.google.internal`, `metadata.goog`

`env_var_name`: none.
