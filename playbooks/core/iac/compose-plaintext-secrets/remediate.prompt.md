## Playbook: iac/compose-plaintext-secrets (remediate)

Move the secret out of docker-compose.yml. Two canonical options:

**1. Environment file (simple, local-dev friendly):**

```yaml
services:
  api:
    env_file:
      - .env.api
```

And add `.env.api` to `.gitignore`.

**2. Docker secrets (swarm / compose v3.1+):**

```yaml
secrets:
  api_key:
    file: ./secrets/api_key
services:
  api:
    secrets:
      - api_key
    environment:
      API_KEY_FILE: /run/secrets/api_key
```

For real deployments, prefer pulling from Vault / AWS Secrets Manager /
GCP Secret Manager via the platform's native injection rather than
baking secrets into files at all.

If the secret *was* real and has now been committed to git history,
rotate it immediately and use `git-filter-repo` to remove it from
history.
