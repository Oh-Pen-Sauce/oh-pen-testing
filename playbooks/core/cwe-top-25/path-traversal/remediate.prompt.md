## Playbook: cwe-top-25/path-traversal (remediate)

Validate with `path.resolve` + prefix check:
```
const resolved = path.resolve(BASE, req.params.file);
if (!resolved.startsWith(BASE + path.sep)) throw new Error('forbidden');
```
For Python: `os.path.realpath` + startswith check. Never just string-replace `../`.
