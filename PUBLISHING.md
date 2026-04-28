# Publishing Oh Pen Testing

This is the release runbook — follow this top-to-bottom to cut a version and push it to npm so users can `npm install -g @oh-pen-testing/cli`.

Keep this file up to date when the publish process changes. (See the
"Keeping install notes in sync" section at the bottom.)

---

## One-time setup

You need to do each of these exactly once per machine.

### 1. npm account + scope access

```bash
npm login --scope=@oh-pen-testing --registry=https://registry.npmjs.org/
```

First publish auto-claims the `@oh-pen-testing` scope for whoever runs it.
If the scope is already claimed under an org, add yourself as a member
via the npm web UI (npmjs.com → Organizations → oh-pen-testing →
Members) before running publish.

### 2. Enable 2FA for publish (recommended)

**Do this via the npm web UI, not the CLI.** npm deprecated CLI-based
TOTP enrollment in 2025 — `npm profile enable-2fa auth-and-writes`
returns `404 — Adding a new TOTP 2FA is no longer supported`.

Visit:

```
https://www.npmjs.com/settings/<your-username>/tfa
```

Two methods are offered there:

- **Security key / passkey** (Touch ID, Yubikey, browser passkey).
  npm now pushes this as the default. Best UX going forward.
- **Authenticator app (TOTP)** — still allowed via the web UI. Scan
  the QR with Google Authenticator / 1Password / Authy. After
  enrollment, `npm publish` prompts for the 6-digit code from the
  authenticator on the CLI as before.

Set the mode to **"Authentication and writes"** (the equivalent of
the CLI's `auth-and-writes`).

Worth it — a leaked npm token can publish malware to every package
in your scope.

### 3. One-shot dry-run audit

```bash
pnpm -r exec npm pack --dry-run
```

Walks every package and shows what would go in each tarball. Look for:

- Nothing weird (no source maps leaking secrets, no `.env*`, no
  node_modules bloat).
- Every package you expect to publish is listed.
- `@oh-pen-testing/web` is NOT listed — it's private.

---

## Release flow

### 1. Bump versions

All published packages ship together at the same version. Use
`pnpm -r` to bump every workspace package atomically:

```bash
# patch (1.0.0 → 1.0.1)
pnpm -r --filter "!@oh-pen-testing/web" exec npm version patch --no-git-tag-version

# minor (1.0.1 → 1.1.0)
pnpm -r --filter "!@oh-pen-testing/web" exec npm version minor --no-git-tag-version

# major (1.1.0 → 2.0.0)
pnpm -r --filter "!@oh-pen-testing/web" exec npm version major --no-git-tag-version
```

The `!@oh-pen-testing/web` filter excludes the Next.js app (private).

Also update `CLI_VERSION` in `packages/cli/src/index.ts` to match.

### 2. Clean + build everything

```bash
pnpm -r exec rm -rf dist .turbo
pnpm install --frozen-lockfile
pnpm turbo run build
```

### 3. Run the test suite

```bash
pnpm test
pnpm turbo run typecheck
```

Both must pass. Don't release a red build.

### 4. Smoke-test the packed CLI locally

This catches 90% of publish bugs before they reach users.

```bash
# Pack every published package into /tmp
rm -rf /tmp/opt-publish-test && mkdir -p /tmp/opt-publish-test/tarballs
for pkg in packages/shared packages/rate-limit \
           packages/git-adapters/github packages/git-adapters/gitlab packages/git-adapters/bitbucket \
           packages/providers/anthropic packages/providers/claude-code-cli packages/providers/ollama \
           playbooks/core packages/core packages/cli; do
  pnpm --filter "./$pkg" pack --pack-destination /tmp/opt-publish-test/tarballs
done

# Install all tarballs into a fresh dir
rm -rf /tmp/opt-install-test && mkdir /tmp/opt-install-test && cd /tmp/opt-install-test
npm init -y >/dev/null
npm install /tmp/opt-publish-test/tarballs/*.tgz

# CLI works from the installed package?
./node_modules/.bin/opt --version
./node_modules/.bin/opt --help | head -20

# opt connect works against a real provider?
mkdir -p /tmp/opt-smoke && cd /tmp/opt-smoke
/tmp/opt-install-test/node_modules/.bin/opt connect --provider claude-code-cli
ls .ohpentesting/   # should have config.yml

# Clean up
cd /tmp && rm -rf opt-publish-test opt-install-test opt-smoke
```

If any of those step fail, **stop and fix before publishing**.

### 5. Publish in dependency order

Dependencies must land first or npm will reject dependents that
reference unpublished versions. The order is:

```bash
# 1. No internal deps
pnpm --filter @oh-pen-testing/shared publish --no-git-checks

# 2. Depend only on shared
pnpm --filter @oh-pen-testing/rate-limit publish --no-git-checks
pnpm --filter @oh-pen-testing/git-github publish --no-git-checks
pnpm --filter @oh-pen-testing/git-gitlab publish --no-git-checks
pnpm --filter @oh-pen-testing/git-bitbucket publish --no-git-checks
pnpm --filter @oh-pen-testing/providers-anthropic publish --no-git-checks
pnpm --filter @oh-pen-testing/providers-claude-code-cli publish --no-git-checks
pnpm --filter @oh-pen-testing/providers-ollama publish --no-git-checks
pnpm --filter @oh-pen-testing/playbooks-core publish --no-git-checks

# 3. Depends on all providers + git + shared + playbooks
pnpm --filter @oh-pen-testing/core publish --no-git-checks

# 4. Depends on everything above
pnpm --filter @oh-pen-testing/cli publish --no-git-checks
```

pnpm rewrites `workspace:*` → the real version at publish time, so
dependents point at the just-published numbers correctly.

`--no-git-checks` skips pnpm's "uncommitted changes / not on main"
safety nets — remove that flag once you're doing clean-tag releases
from main only.

### 6. Verify the registry

```bash
npm view @oh-pen-testing/cli version
# → 1.0.1  (or whatever you just cut)

# And that the tarball actually works as a fresh install:
npx @oh-pen-testing/cli@latest --version
```

### 7. Tag + push

```bash
VERSION=$(node -p "require('./packages/cli/package.json').version")
git tag "v$VERSION"
git push origin main "v$VERSION"
```

### 8. Cut a GitHub release

```bash
gh release create "v$VERSION" \
  --title "v$VERSION" \
  --generate-notes \
  --latest
```

---

## Troubleshooting

**`403 Forbidden — You do not have permission to publish`**
Either the `@oh-pen-testing` scope isn't claimed by your account, or
2FA auth isn't valid. Re-run `npm login` and try again.

**`402 Payment Required`**
Scoped packages default to private (which requires a paid npm org).
Every package has `publishConfig: { "access": "public" }` in its
package.json — if the error persists, check you didn't accidentally
remove that field in a recent edit.

**`ERESOLVE` when users try `npm install`**
A published dependency references a version that doesn't exist on the
registry yet. Almost always means publish order got swapped in step
5. Re-run the missing package's publish, then tell users to retry.

**User reports `opt: command not found` after `npm install -g`**
Check the tarball kept the `bin` field: `npm view @oh-pen-testing/cli bin`.
Should print `opt` + `oh-pen-testing`. If not, the build didn't emit
the shebang — check `packages/cli/tsup.config.ts` has
`banner: { js: "#!/usr/bin/env node" }`.

**User reports "playbooks not found"**
`@oh-pen-testing/playbooks-core`'s `files` array in package.json must
include every top-level playbook directory (`secrets`, `owasp`, `sca`,
`wstg`, `cwe-top-25`, `iac`, `asvs`). Missing dir = missing playbooks
after install. Fix in the package.json, re-pack, re-test step 4.

---

## Keeping install notes in sync

**When to update this file and README.md**

Whenever a PR touches any of the following, the PR must also update
this file + the README install section:

- Any `package.json` in `packages/*` or `playbooks/*` gaining or
  losing a runtime dependency
- A new workspace package added to the publish list
- A workspace package moved to `"private": true` (or vice versa)
- Changes to `packages/cli/tsup.config.ts` that affect how the built
  CLI is emitted (shebang, format, externals)
- A new CLI subcommand that affects first-run UX
- Changes to `Node` engine floor
- New keychain / env-var secrets introduced by the CLI
- A new install target added (Homebrew tap, Docker image, arch)

Rule of thumb: **if the way a user gets `opt` working on their
machine changes**, the README install section changes too. Don't
let them drift.
