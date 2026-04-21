## Playbook: insecure-tls-version (remediate)

Raise the minimum to TLSv1.2 (TLSv1.3 if the language/runtime supports it).

- Node: `{ minVersion: "TLSv1.2" }` — drop `rejectUnauthorized: false` unless there's a documented reason.
- Python ssl: `PROTOCOL_TLS_CLIENT` + `context.minimum_version = ssl.TLSVersion.TLSv1_2`.
- Java: remove SSLv3/TLSv1 from `SSLContext.getInstance(...)`; use `TLSv1.2` or `TLSv1.3`.
- If the remote truly requires legacy, leave a comment `// tls-legacy: <URL to incident>` so the next scan can skip.

`env_var_name`: none.
