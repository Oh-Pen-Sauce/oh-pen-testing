# Security Policy

## Reporting a vulnerability

Oh Pen Testing is a security tool — we take vulnerabilities in it seriously.

If you find a security issue, **please do not open a public GitHub issue.** Email the maintainers instead:

- `security@oh-pen-sauce.com` (preferred)

Please include:

- A description of the issue
- Steps to reproduce
- The version / commit SHA affected
- Your preferred credit attribution (or "anonymous")

We aim to acknowledge receipt within 72 hours, provide a mitigation plan within 14 days, and publicly disclose within 90 days (coordinated with you).

## What we consider in-scope

- Issues in the scanning engine (e.g. prompt injection that causes false "clean" reports)
- Issues in the agent remediation flow (e.g. agent-generated patches that introduce new vulnerabilities)
- Issues in the CLI that could leak credentials
- Issues in the web app that could leak local state to third parties
- Supply-chain issues in our published packages

## What's out-of-scope

- Vulnerabilities in dependencies — please report those to the upstream project. (We'll still bump our pin if you let us know.)
- Intentional behaviour that is risky by design — e.g. agents write files when you tell them to. Check the "risky tests" toggles.
- Social-engineering / physical attacks against maintainers.

## Our own scanning

We dogfood Oh Pen Testing on the Oh Pen Testing repo. Every release runs the full playbook suite against itself. Results are in `.ohpentesting/` of each tagged release.

## Supported versions

M0 (v0.0.x) is a preview. Security fixes land in the next version; there is no backport window.
