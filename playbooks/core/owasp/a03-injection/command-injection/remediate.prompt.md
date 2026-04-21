## Playbook: command-injection (remediate)

Move off the shell. Pass args as an array.

- Node: `execFile("git", ["clone", url], cb)` instead of `exec(\`git clone ${url}\`)`. Same for `spawn`.
- Python: `subprocess.run(["git", "clone", url], check=True)` — no `shell=True`.
- For anything that must use a shell (rare), validate against a strict allowlist first and escape with a library (`shlex.quote`, `shell-escape`).

Preserve what the original call was trying to do; don't rewrite the business logic.

`env_var_name`: none.
