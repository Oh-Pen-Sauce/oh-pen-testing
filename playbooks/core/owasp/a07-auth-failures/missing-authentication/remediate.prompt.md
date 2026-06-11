## Playbook: owasp/a07-auth-failures/missing-authentication (remediate)

Add an authentication (and, where needed, authorisation) middleware before the handler. Do not rely on the path being hard to guess.

Put the guard in the argument chain, ahead of the handler:
```
// before
router.delete("/admin/users/:id", async (req, res) => { ... });

// after
router.delete("/admin/users/:id", requireAuth, requireRole("admin"), async (req, res) => { ... });
```

For a whole group of sensitive routes, mount the guard once on the router so a new route cannot forget it:
```
const admin = express.Router();
admin.use(requireAuth, requireRole("admin"));
admin.delete("/users/:id", handler);
app.use("/admin", admin);
```

Notes:
- Authentication proves who the caller is; authorisation proves they are allowed this action. Admin routes need both.
- Never ship a route guarded only by a comment or a `TODO`. Fail closed: return 401 when there is no valid session, 403 when the session lacks the role.
- Remove or fully lock down `/debug` and `/internal` endpoints before production; they often leak environment variables and config.

`env_var_name`: none.
