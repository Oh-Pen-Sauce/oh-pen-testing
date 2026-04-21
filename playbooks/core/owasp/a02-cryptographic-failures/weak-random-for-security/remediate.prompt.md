## Playbook: weak-random-for-security (remediate)

Replace with CSPRNG:

- Node: `crypto.randomBytes(32).toString("base64url")`
- Python: `secrets.token_urlsafe(32)`
- Java: `SecureRandom`
- Ruby: `SecureRandom.urlsafe_base64(32)`
- Go: `crypto/rand.Read`

Preserve the surrounding variable name and the length/format the code expected. Don't change the API signature.

`env_var_name`: none.
