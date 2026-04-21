## Playbook: default-credentials (scan)

Confirm when:
- A common default password is assigned to a `password`/`passwd`/`pwd` variable.
- Username + matching common password (admin/admin, root/root) both literal in config.

Do NOT confirm when:
- The password is documented as a placeholder in a `.env.example` file (file path clearly indicates an example).
- The string is part of a regex or explanation in comments.
- It's a seed in a test fixture AND the file path contains `test`.

Severity:
- `critical` — default creds in a deployment config or DB init script.
- `high` — default creds in source that runs in any environment.
- `medium` — default creds in a `.env.example` that's committed; users might copy it verbatim.
