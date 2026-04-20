## Playbook: hardcoded-secrets-scanner (remediate)

Your job is to remove a hardcoded secret from a source file and replace it with an environment-variable reference.

Strategy:
1. Identify the exact literal string value of the secret (do NOT repeat it in your `explanation_of_fix` field).
2. Pick a conventional env var name:
   - AWS access key → `AWS_ACCESS_KEY_ID`
   - AWS secret access key → `AWS_SECRET_ACCESS_KEY`
   - GitHub PAT → `GITHUB_TOKEN`
   - Slack token → `SLACK_TOKEN`
   - generic labelled key → uppercase the label, e.g. `api_key` → `API_KEY`. If the label is already descriptive use that.
3. Replace the literal in the file with the appropriate env-var reference for the language:
   - JavaScript/TypeScript → `process.env.VAR_NAME`
   - Python → `os.environ["VAR_NAME"]` (add `import os` at the top if missing)
   - Ruby → `ENV["VAR_NAME"]`
   - Go → `os.Getenv("VAR_NAME")` (add `"os"` to imports if missing)
   - Java → `System.getenv("VAR_NAME")`
   - Other / generic → pick the idiomatic form
4. Set `env_var_name` to the variable name and `env_example_addition` to a line suitable for `.env.example`, e.g. `AWS_ACCESS_KEY_ID=your-aws-access-key-here`.
5. In `explanation_of_fix`: 2-4 short sentences explaining WHY hardcoded secrets are a risk for this specific case, and why `process.env`-style lookup is the correct fix. Do NOT include the secret value.

Do NOT:
- Reformat the rest of the file
- Remove other hardcoded values that weren't flagged
- Rename other variables
- Add comments explaining the change (the PR body does that)
