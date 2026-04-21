## Playbook: clickjacking-no-frame-options (remediate)

Install `helmet` and add `app.use(helmet())`. That ships sensible defaults for X-Frame-Options, CSP, HSTS, and more. For CSP specifically: `helmet({ contentSecurityPolicy: { directives: { frameAncestors: ["'none'"] } } })`.
