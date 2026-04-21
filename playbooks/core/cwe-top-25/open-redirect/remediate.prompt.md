## Playbook: open-redirect (remediate)

Allowlist the target:
```
const ALLOWED = ["/dashboard", "/onboarding"];
const target = String(req.query.next ?? "/");
if (!ALLOWED.includes(target) && !target.startsWith("/")) return res.redirect("/");
res.redirect(target);
```
Never redirect to an absolute URL taken from user input without host-allowlist check.
