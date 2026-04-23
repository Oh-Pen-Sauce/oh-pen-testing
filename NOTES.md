# Oh Pen Testing — outstanding tasks after v1.0.0

This file tracks the work that remains after the M7–M17 feature batch
and the v1.0.0 cut. Everything in the PRD is implemented in-repo;
these are the external-world / operational items a human needs to
complete.

---

## Distribution

### Homebrew tap

We ship a CLI binary through Homebrew, but the tap itself is an external
GitHub repo that homebrew fetches formulae from.

**Steps:**

1. Create a new public GitHub repo called `homebrew-tap` under the
   `oh-pen-sauce` org (the org must exist; otherwise under whoever
   owns the Oh Pen Testing project — today that's `@samnash`).
2. Add a single formula file at `Formula/oh-pen-testing.rb`:

   ```ruby
   class OhPenTesting < Formula
     desc "Local opensource pen-testing suite. Your code. Your AI. Your terms."
     homepage "https://oh-pen-testing.dev"
     url "https://registry.npmjs.org/@oh-pen-testing/cli/-/cli-1.0.0.tgz"
     sha256 "<SHA_OF_NPM_TARBALL>"
     license "MIT"

     depends_on "node@22"

     def install
       system "npm", "install", "--production",
              "--prefix=#{libexec}", "@oh-pen-testing/cli@#{version}"
       (bin/"opt").write_env_script libexec/"bin/opt",
                                     :PATH => "#{HOMEBREW_PREFIX}/opt/node@22/bin:$PATH"
     end

     test do
       assert_match "oh-pen-testing",
                    shell_output("#{bin}/opt --version")
     end
   end
   ```

3. Replace `<SHA_OF_NPM_TARBALL>` by running `shasum -a 256` against the
   tarball from `https://registry.npmjs.org/@oh-pen-testing/cli`.
4. Tag the tap repo `v1.0.0` and the install command becomes
   `brew install oh-pen-sauce/tap/oh-pen-testing`.

### npm publish — packages prepped, waiting on `npm login`

Every public workspace package is publish-ready:

- `private: true` removed from the 11 publishable packages
  (kept on `@oh-pen-testing/web` — it's a Next app, not a lib)
- `publishConfig: { access: "public" }` + MIT license + repo /
  homepage / bugs / engines fields on each
- CLI tarball verified to include the `#!/usr/bin/env node` shebang
- `@oh-pen-testing/playbooks-core` `files` includes every playbook
  dir (secrets, owasp, sca, wstg, cwe-top-25, iac, asvs)
- Local smoke test passed: pack → install → `opt --version` → `opt
  connect` → config.yml written. End-to-end green.

**Full publish runbook now lives in [`PUBLISHING.md`](./PUBLISHING.md)** — follow that top-to-bottom for every release. It covers:

- one-time npm login / 2FA / scope-claiming
- version bump via `pnpm -r`
- packed-tarball smoke test before upload
- the exact publish order (dependency graph matters — shared first,
  then leaf libs, then core, then CLI)
- registry verification + GitHub release tag

Quick summary for first release:

```bash
npm login --scope=@oh-pen-testing --registry=https://registry.npmjs.org/
# Then follow PUBLISHING.md steps 2–8.
```

After first publish, users can run the real one-liner:

```bash
npm install -g @oh-pen-testing/cli
opt setup
```

Or `npx @oh-pen-testing/cli@latest setup` with zero install.

Confirm these packages publish successfully (others are private):
- `@oh-pen-testing/shared`
- `@oh-pen-testing/rate-limit`
- `@oh-pen-testing/providers-*` (all 3)
- `@oh-pen-testing/git-github`, `@oh-pen-testing/git-gitlab`, `@oh-pen-testing/git-bitbucket`
- `@oh-pen-testing/core`
- `@oh-pen-testing/cli`
- `@oh-pen-testing/playbooks-core`

`@oh-pen-testing/web` is `private: true` — it ships inside the Docker
image, not via npm.

### Docker image

The Dockerfile at the repo root builds a runtime image with both the
CLI and the web UI. To publish:

```bash
docker build -t ghcr.io/oh-pen-sauce/oh-pen-testing:1.0.0 .
docker push ghcr.io/oh-pen-sauce/oh-pen-testing:1.0.0
docker tag ghcr.io/oh-pen-sauce/oh-pen-testing:1.0.0 \
           ghcr.io/oh-pen-sauce/oh-pen-testing:latest
docker push ghcr.io/oh-pen-sauce/oh-pen-testing:latest
```

Needs a GitHub PAT with `write:packages` set as `GHCR_PAT` in the
local shell and `docker login ghcr.io -u <user> -p $GHCR_PAT` first.

---

## Infrastructure / hosting

### `oh-pen-testing.dev` — marketing site

Not in this repo. Needs a separate small Next.js site that:
- renders live stats from the telemetry endpoint (see below)
- links to the GitHub repo, npm package, Homebrew tap, Docker image
- hosts a `/share/<scan-hash>` page that renders share-card SVGs

### Telemetry endpoint

`packages/shared/src/telemetry.ts` POSTs `scan_completed` events to a
configurable endpoint (default: `https://telemetry.oh-pen-testing.dev/v1/events`).
That endpoint doesn't exist yet — it needs:

1. A tiny serverless function (Cloudflare Workers / Deno Deploy is fine).
2. A KV/SQL store counting: `total_scans`, `total_lines_analysed`,
   `total_issues_found`, `total_issues_remediated`, grouped by month.
3. A `GET /v1/stats` endpoint returning the aggregates for the
   marketing-site dashboard.
4. **Zero PII**: reject any event whose `install_id` doesn't match the
   SHA-256 format the client generates, and never persist IPs.

### Playbook registry

`@oh-pen-testing/core` ships the `fetchRegistryIndex` / `installPlaybook`
client but no registry is yet published. To start one:

1. Create a public repo, e.g. `oh-pen-testing-registry`.
2. Add `index.json` at the root following the schema in
   `packages/core/src/registry/types.ts`.
3. Host it on GitHub Pages (or any static host).
4. Users add the URL to `playbook_registries:` in their config.

A good seed list: community ports of `gitleaks` patterns, the full WSTG
catalogue, CWE Top 25 coverage we didn't ship bundled.

---

## Post-v1 roadmap candidates

Ordered by user value, not effort.

### Manifest signing for registry playbooks
Today the client verifies SHA-256 of individual files — good protection
against a CDN swap, but not against a malicious registry owner. Add
optional ed25519 signatures at the `RegistryEntry` level and let users
pin trusted signing keys in their config.

### Dynamic testing: more playbooks
Current bundled set (security-headers, no-rate-limit-login,
open-redirect-probe) is enough to prove the framework. Next wave:
- CORS reflection (`Origin: attacker.invalid` probe)
- Session-fixation probe (set cookie pre-auth, check if it survives)
- GraphQL introspection in prod
- JWT `alg: none` / weak-key try

### SARIF output per tool (not just the full scan)
Many users pipe SARIF into DefectDojo / GHAS but want to split by
playbook. Add `opt report --format sarif --per-playbook`.

### VS Code extension
A minimal extension that:
- surfaces `.ohpentesting/issues/*.json` as a panel
- runs `opt scan` on demand
- shows blame timeline inline on the line that triggered each issue

### Full agent-authored playbook creation
Let a user paste an OWASP WSTG URL and have an agent auto-generate a
playbook directory (manifest + prompts + fixtures). Wonk reviews.

### Compliance exports
`opt compliance -f soc2` currently writes markdown. Add:
- PDF (reuse `@oh-pen-testing/shared/pdf-report`)
- Drata / Vanta import format (CSV or their proprietary API)

### Learning-mode feedback loop
Today learning events are recorded but not acted on. Next step: an
`opt playbooks tune` command that reads the local NDJSON log and
suggests regex tweaks (e.g. "rule X fires 80% false-positive on repo
Y; consider adding a negative lookahead for pattern Z").

---

## Rebasing onto the new identity

Until `oh-pen-sauce` org is created, some URLs still point at the
transitional user-scoped values:

- `package.json` fields (homepage, repository) currently point to
  `github.com/samnash/oh-pen-testing`. Update to
  `github.com/oh-pen-sauce/oh-pen-testing` once the org move happens.
- `action.yml` GitHub Action — same.
- `README.md` badges and install snippets.

Single pass via `grep -rl "samnash/oh-pen-testing" .` after the rename.
