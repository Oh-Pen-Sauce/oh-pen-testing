# GitHub Action

Run Oh Pen Testing on every pull request. Findings post to the PR, land in the Code Scanning tab, and the action fails on severity thresholds you choose.

## Minimal example

```yaml
# .github/workflows/oh-pen-testing.yml
name: security

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  pull-requests: write
  security-events: write   # for SARIF upload to Code Scanning

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # needed for git blame timeline

      - uses: Oh-Pen-Sauce/oh-pen-testing@v1
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          fail-on: high
```

## Inputs

| input | default | description |
|---|---|---|
| `provider` | `claude-api` | `claude-api` / `claude-code-cli` / `ollama` |
| `anthropic-api-key` | — | Required when `provider=claude-api` |
| `github-token` | `${{ github.token }}` | Token for PR comments + remediation PRs |
| `autonomy` | `careful` | `full-yolo` / `yolo` / `recommended` / `careful` |
| `fail-on` | `high` | Fail the workflow if findings at or above this severity exist |
| `post-pr-comment` | `true` | Comment with summary on the PR |
| `upload-sarif` | `true` | Feed into GitHub Code Scanning tab |

## Outputs

| output | description |
|---|---|
| `scan-id` | The `SCAN-XXX` id of the run |
| `issues-found` | Total issues |
| `sarif-path` | Path to the emitted SARIF file |

## Example: auto-remediate with Marinara in CI

```yaml
- uses: Oh-Pen-Sauce/oh-pen-testing@v1
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    autonomy: recommended
    fail-on: critical
- name: Agent pool opens PRs for new findings
  if: failure()
  run: opt remediate --all
  env:
    GITHUB_TOKEN: ${{ secrets.OHPEN_BOT_PAT }}
```

## Example: fully offline scan (Ollama side-car)

```yaml
services:
  ollama:
    image: ollama/ollama
    ports: ["11434:11434"]

steps:
  - run: docker exec ollama ollama pull kimi-k2.6
  - uses: Oh-Pen-Sauce/oh-pen-testing@v1
    with:
      provider: ollama
```

No API key cost in CI, no code leaves the runner.
