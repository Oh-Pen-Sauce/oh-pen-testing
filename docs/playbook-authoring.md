# Authoring a playbook

A playbook is a directory under `playbooks/core/` (or your repo's `.ohpentesting/playbooks/local/`) containing:

```
your-playbook/
├─ manifest.yml          # metadata + regex rules
├─ scan.prompt.md        # AI confirmation guidance
├─ remediate.prompt.md   # fix strategy
└─ tests/
   ├─ positive/          # files the playbook MUST flag
   └─ negative/          # files the playbook must NOT flag
```

## manifest.yml

```yaml
id: owasp/a03-injection/your-playbook-id
version: 1.0.0
category: owasp-top-10                   # owasp-top-10 | secrets | sca | wstg | cwe-top-25 | custom
owasp_ref: A03:2021
cwe: [CWE-89]
severity_default: high                   # info | low | medium | high | critical
languages: [javascript, typescript, python]
authors: [your-handle]
description: "One-sentence summary of what this catches."
risky: false                             # true means "user must explicitly opt in"
requires_ai: true
type: regex                              # regex | ast | prompt | sca

rules:
  - id: descriptive-rule-id
    description: "What this specific rule catches."
    pattern: '\byour-regex-here\b'
    flags: g                             # g | gi | gs | gis
    require_ai_confirm: true             # if false, regex hit → issue directly
```

## Regex rules — battle-tested patterns

| Goal | Pattern |
|---|---|
| Match API followed by space OR `=` not already followed by a quote | `API\s*=(?!\s*["'` + "`" + `])` |
| Match a template literal containing interpolation | `` `[^`]*\$\{[^}]+\}[^`]*` `` |
| Match a Python f-string with variable interpolation (any quote style) | `f(["'])[^"']*\{[^}]+\}[^"']*\1` |
| Match an assignment where the key might be quoted (JSON/dict style) | `["'` + "`" + `]?keyname["'` + "`" + `]?\s*[:=]` |

**Gotcha:** YAML single-quoted strings allow `'` via `''` (doubled) but backslashes are literal — good for regex. YAML parses keys containing `:` as nested maps; **always quote** descriptions containing colons. The fixture-gate picks up broken YAML fast.

## scan.prompt.md

Short markdown that the scanner prepends to the system prompt when asking the AI to confirm a candidate hit. Structure:

```md
## Playbook: <id> (scan)

Confirm when:
- <specific marker>
- <another>

Do NOT confirm when:
- <known false-positive pattern>

Severity:
- `critical` — <what>
- `high` — <what>
- `medium` — <what>
- `low` — <what>
```

The AI response is constrained to `{ confirmed: bool, severity: ..., reasoning: string }` by the scanner's JSON schema. Don't ask for free-form output.

## remediate.prompt.md

Prepended to the remediation prompt. Tell the agent:

1. **The preferred fix pattern** with a concrete code example in the target language.
2. **What not to touch** — reformatting, adjacent bugs, style changes.
3. **Env var name** (if the fix introduces a new env var).
4. **When to set `auto_fixable: false`** — if the fix requires scaffolding (e.g. installing a new dependency) the agent can't do safely.

## Fixtures

Every regex playbook must ship `tests/positive/` and `tests/negative/` fixtures. The fixture-gate test auto-discovers them and asserts:

- Every file under `positive/` produces **≥ 1 hit**
- Every file under `negative/` produces **0 hits**

Keep fixtures small and focused. One realistic pattern per file is better than one mega-fixture with ten variations.

## Iterating

```bash
# Run just your playbook's fixtures
pnpm test -- -t "your-playbook-id"

# Scan a scratch repo end-to-end (regex + AI confirmation)
opt scan --cwd /path/to/scratch-repo --playbooks 'your-playbook-id'
```

## SCA playbooks

If your playbook is type `sca` (shells out to an external auditor):

```yaml
type: sca
sca_sources: [npm-audit, pip-audit, bundler-audit]
```

No `rules:`, no fixtures. The runtime skips auditors whose manifest file (package.json / requirements.txt / Gemfile.lock) is absent, so a single SCA playbook can safely cover all three.

## Getting it into the core library

1. Draft under your repo's `.ohpentesting/playbooks/local/` first — useful for you immediately.
2. Open a PR against `oh-pen-testing` moving it to `playbooks/core/<category>/`.
3. The auto-fixture-gate will confirm it works; maintainers review prompts for tone + accuracy.
