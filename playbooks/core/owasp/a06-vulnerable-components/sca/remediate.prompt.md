## Playbook: sca (remediate)

For each vulnerable dependency:

1. If a patched version is available (check `fix_versions` / `patched_versions`), bump the direct dep in `package.json` / `requirements.txt` / `Gemfile` to that range.
2. For transitive deps (not in your direct deps), use:
   - npm: `npm audit fix` (careful: can introduce breaking changes; prefer explicit override).
   - pip: add a constraint in `requirements.txt` pinning the transitive.
   - bundler: `bundle update <gem>` if dep policy allows.
3. Leave a comment `// sec-bump: <CVE-id>` next to the bumped line so future scans can trace it.
4. If no patched version exists, open the issue for manual review and don't attempt a fix.

`env_var_name`: none.
