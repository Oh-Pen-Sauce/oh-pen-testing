## Playbook: cwe-top-25/path-traversal (scan)

Confirm when a file path concatenates or interpolates user input without `path.resolve` + prefix validation.

Severity:
- critical — serves arbitrary files under any traversal
- high — serves files only within an intended base but without canonicalisation
- medium — likely safe after `path.resolve` + check
