# Getting started

5-minute tour from zero to first verified fix.

## 1. Install

Pick whichever you prefer. All paths yield the same `opt` binary.

```bash
npx oh-pen-testing@latest init     # zero-install
# or
npm install -g @oh-pen-testing/cli
# or
brew tap oh-pen-sauce/tap
brew install oh-pen-testing
```

## 2. Scaffold a config

```bash
cd /path/to/your/repo
opt init
```

Creates `.ohpentesting/` with:

- `config.yml` — provider, git, autonomy mode, scope
- `issues/` — findings land here, one JSON file per issue
- `scans/` — scan-run metadata
- `reports/` — markdown / SARIF / PDF output
- `playbooks/local/` — your own playbooks (optional)

`opt init` auto-detects the best-available provider. If you have `claude` on PATH (the Claude Code CLI), it defaults to that — zero API key required on Max.

## 3. Pick credentials

### Option A — Claude Code CLI (free on Max)

Nothing to do. If `claude` is on PATH, `opt init` already configured this.

### Option B — Claude API

```bash
export ANTHROPIC_API_KEY=sk-ant-…
# or put it in the OS keychain:
security add-generic-password -s oh-pen-testing -a anthropic-api-key -w
```

### Option C — fully local (Ollama)

```bash
brew install ollama
ollama serve &
ollama pull kimi-k2.6
# then in config.yml set ai.primary_provider: ollama
```

## 4. Authorise the scan

First scan prompts:

```
⚠  Authorisation check — Oh Pen Testing only scans code you're authorised to test.
   Target: /path/to/your/repo

Do you confirm you have authorisation to run security testing against this codebase? (y/N)
```

Say `y`. The acknowledgement is persisted to `scope.authorisation_acknowledged` so you won't be nagged again for this repo.

## 5. Scan

```bash
opt scan
```

Runs all 22 OWASP Top 10 playbooks + the SCA auditors that apply to your stack (npm-audit / pip-audit / bundler-audit). Output:

```
▶ Scanning with Claude Code CLI (claude-sonnet-4-6)

✔ Scan SCAN-001 complete
  playbooks run:   22
  issues found:    7
  AI calls:        14

Issues:
  [CRITICAL] ISSUE-001 SQL injection in src/api/users/search.ts
  [HIGH]     ISSUE-002 Missing auth on POST /api/accounts/:id
  ...
```

## 6. Triage

```bash
opt setup   # opens http://127.0.0.1:7676
```

The kanban board surfaces every issue with:

- **Scanner output** (machine-verifiable) — file, line, matched string
- **AI analysis** (advisory) — what it thinks is going on, with a provenance block

Click a card to change status, or open the detail view for the full side-by-side.

## 7. Remediate

Single issue:

```bash
export GITHUB_TOKEN=ghp_…
opt remediate --issue ISSUE-001
```

Or the whole board:

```bash
opt remediate --all
# ▶ Running agent pool (autonomy: recommended, parallelism: 4)
#   → marinara picked up ISSUE-003
#   → alfredo picked up ISSUE-002
#   ✔ marinara opened PR for ISSUE-003: https://github.com/...
#   ⏸ alfredo paused on ISSUE-002: trigger: auth_changes
```

Anything gated by the autonomy mode shows up in **/reviews** with an "Approve" button (or run `opt approve --issue ISSUE-002`).

## 8. Verify

After you merge the PR (or apply the fix manually):

```bash
opt verify --issue ISSUE-001
```

Reruns the playbook that flagged it against the current file. If zero hits remain, the issue moves to `verified` with a timestamp.

## 9. Report

```bash
opt report --format markdown   # .ohpentesting/reports/oh-pen-testing-report.md
opt report --format sarif      # GitHub Code Scanning / Snyk / Sonatype
opt report --format pdf        # consultancy-grade deliverable
```

## 10. Schedule

```bash
opt schedule --nightly
```

Installs a launchd plist (macOS) or crontab entry (Linux) that runs `opt scan` at 02:00 local every night. `--remove` tears it down.

---

**That's the whole loop.** If you hit something confusing, open a GitHub issue — docs gaps are first-priority fixes.
