## Playbook: iac/compose-plaintext-secrets (scan)

A docker-compose.yml file appears to contain a hard-coded secret. Confirm
whether the literal is a real secret (prod/staging API key, DB password,
private key) rather than a placeholder for local development.

Severity:
- critical — a credential for a real service (AWS, Stripe, OpenAI, prod DB)
- high — a credential for a shared staging / CI environment
- low — an obvious local-dev placeholder like `password: devpassword`

Things that are NOT this finding:
- `${SECRET_NAME}` interpolations (the real value lives elsewhere)
- `env_file:` references (the secret lives in the referenced file,
  which should be gitignored separately)
