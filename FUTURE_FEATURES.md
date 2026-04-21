# Oh Pen Testing — Future Features

Features intentionally deferred from v0.5 to keep the MVP shippable. Each item here is a v1.0+ candidate, not an abandoned idea.

---

## v1.0 — the "pen test consultancy replacement" release

### Dynamic testing suite
Run real attack traffic against a deployed instance (dev/staging only, with user confirmation). Captures runtime vulns static analysis misses:
- Auth bypass via token replay
- Session fixation
- CSRF chain exploits
- Timing attacks
- Rate-limit absence
- API schema enforcement gaps

Requires: sandboxed runner, explicit URL allowlist (localhost + user-approved hosts only), dry-run mode, full audit log of every request sent.

### PDF pen-test report export
The crown jewel of v1.0. One command (`oh-pen-testing report --format pdf`) produces a report that looks like a £15k consultancy deliverable:
- Executive summary with findings-by-severity chart
- Methodology section (which standards were tested, which tools, how)
- Per-issue detail: description, evidence, impact, remediation, verification
- "Before/after" diffs for every fixed issue
- Residual risks section (what we scanned and found nothing — a negative result is still a result)
- Signature page: tool version, scan timestamps, commit SHA, playbook checksums
- Professional typography, cover page, TOC

Users attach this to enterprise buyer due-diligence, investor rooms, SOC2 evidence packets.

### Playbook registry & community contributions
Move from "curated-only" to "curated core + community-contributed, signed" model:
- Public registry at `registry.oh-pen-sauce.com` (or GitHub-backed)
- Every playbook signed (sigstore or similar); clients verify on install
- Reputation system: downloads, last-updated, maintainer trust score
- `oh-pen-testing playbook install @vendor/react-specific` style syntax
- Governance model for the core/community boundary

### CI/CD integration
- First-class GitHub Action: `uses: oh-pen-sauce/oh-pen-testing@v1`
- GitLab CI template
- PR comment bot: scans pushed code, comments findings inline as review comments
- Fail-on-severity config (`fail_on: critical`)

### GitLab + Bitbucket support
`GitAdapter` interface is defined in v0.5; implementations ship here. Self-hosted GitLab a priority.

### ASVS full coverage (L1, L2, L3)
Expand playbook library from OWASP Top 10 to OWASP ASVS's several-hundred requirements. Generate compliance matrix: "Your codebase covers X/Y of ASVS L1, here are the gaps."

### Full OWASP WSTG implementation
Web Security Testing Guide has ~90 tests; v0.5 ships ~30 core items. v1.0 covers the full set.

### CWE Top 25 full coverage
v0.5 ships 15 critical items; v1.0 covers all 25.

---

## v2.0 — specialised domains

### Docker Compose quickstart for team self-hosting
Single-machine shared install for teams who want to run Oh Pen Testing once and have a small group use it — without going full enterprise (no RBAC, no SSO, no hosted plane).

- `docker-compose.yml` in the repo with two services: the core engine + the web UI on `:7676`.
- Named volumes for `.ohpentesting/` state + OS-keychain-equivalent Docker secrets for credentials.
- `docker compose up` from the repo root spins everything up; `docker compose exec core opt scan /workspace/<repo>` runs scans against mounted repos.
- Still not enterprise: no multi-tenant, no per-user auth, localhost binding by default. Gateway-hosting is a user responsibility.
- Target audience: a 2-5 person startup with a shared dev box, a consultant running against multiple client repos, or an OSS maintainer running Oh Pen Testing on a home server.

**Not a v1.0 requirement.** Indie-dev local `brew install` / `npx` remains the primary distribution path.

### API-specific test suite
OWASP API Security Top 10 (2023):
- Broken object-level authorisation
- Broken authentication
- Broken object property-level authorisation
- Unrestricted resource consumption
- Broken function-level authorisation
- Unrestricted access to sensitive business flows
- SSRF (already in A10)
- Security misconfiguration
- Improper inventory management
- Unsafe consumption of APIs

### Mobile app support
iOS (Swift, Obj-C) and Android (Kotlin, Java). OWASP Mobile Top 10. IPA/APK static analysis. Requires mobile-specific AST tooling.

### Infrastructure-as-Code scanning
Terraform, Pulumi, CloudFormation, Kubernetes manifests. Catches cloud misconfig before deploy. Likely a sibling package (`oh-pen-testing-iac`) sharing the core engine.

### Container scanning
Dockerfile lints + running-container CVE scan. Integrates with Trivy/Grype rulesets.

### SBOM generation & signing
Software Bill of Materials output (CycloneDX, SPDX formats). Signed SBOMs for supply-chain provenance.

---

## v2.5+ — ecosystem & maturity

### IDE integrations
- VS Code extension: inline findings as diagnostics, one-click remediation, "explain this vuln" hover
- JetBrains plugin
- Cursor / Windsurf integration

### Multi-repo / team dashboard
Out of v0.5 scope deliberately, but enterprises will want:
- Central view of all orgs' repos
- Team assignment rules
- SSO (SAML/OIDC)
- Audit log export
- Slack / Teams notifications

Lives in a separate deployment (opensource but runs as a server). Never required for the local-first single-repo flow.

### Compliance mapping
- SOC2 CC6 / CC7 evidence pack
- ISO 27001 Annex A control mapping
- PCI DSS requirement coverage
- HIPAA technical safeguards
- Auto-generate "control coverage" spreadsheet per scan

### Learning mode
Playbooks double as a curriculum:
- "Teach me about A03 injection" walks through examples
- Interactive labs where users deliberately write vulnerable code and watch the tool find it
- Progress tracking: which OWASP categories has this user seen + fixed?

Partnership potential with bootcamps, university security courses.

### Continuous monitoring mode
Daemon watches git for new commits, scans incrementally, files issues in real time. Gradual step toward "runtime security" without becoming a WAF.

### AI-model evaluation
Help users pick the best model for their repo. Runs a benchmark scan with each available provider, compares speed/cost/accuracy, recommends a config. Valuable differentiator.

### Language Tier promotion
Deepen T3 languages (Java, C#, Go, Ruby, PHP) to T1 parity. Add Rust, Elixir, Kotlin server-side.

### Auto-PR merging (guarded)
For trivial CVE bumps with passing tests, optionally auto-merge without human review. Heavily guarded: only specific playbooks (SCA bumps), only patch-level SemVer, only green CI.

---

## Speculative / long-tail

- **Red-team simulation mode** — orchestrates multi-step attacks, not just isolated findings. E.g. "combine CVE in dep A with XSS in page B to achieve account takeover."
- **Bug bounty submission helper** — formats findings for HackerOne/Bugcrowd templates (for use against *your own* disclosed programs).
- **Attestation: "Scanned with Oh Pen Testing v1.2.3"** — embeddable badge + verifiable JSON proof that a specific commit passed a specific playbook version.
- **Federated learning on findings** — users opt in to anonymously contribute finding patterns to improve core playbooks. Hard privacy story; needs careful design.
- **Non-English UX** — i18n for setup wizard, reports, PR templates. Contributor-driven.
- **Voice-readable reports** — "play executive summary to the board" accessibility feature.

---

## Explicit non-goals (likely forever)

- Becoming a WAF or runtime protection layer. Competing space; not our strength.
- SaaS-hosted scanning service. Violates "local-first, never phones home."
- Proprietary playbooks we sell separately. Cuts against MIT spirit.
- Acting as a certification body. We're a tool; certifiers are an institution.
- Scanning other people's code without their consent. Tool refuses `--target` pointing at any repo the user doesn't have write access to.

---

_Last updated: 2026-04-20. Keep this file append-only and dated; features leave when they ship into a version, not when they're abandoned — abandoned ideas move to an `ARCHIVE.md`._
