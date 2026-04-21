## Playbook: missing-authorisation-check (remediate)

Add the project's established auth mechanism to the endpoint. Do not invent a new one.

Strategy:
1. Inspect the file contents for an existing auth middleware. Look for:
   - `requireAuth`, `ensureAuth`, `isAuthenticated`, `authenticate`, `verifyToken`, `auth(...)` in Express
   - `Depends(get_current_user)`, `Depends(require_auth)` in FastAPI
   - `@login_required`, `@permission_required` in Django/Flask
2. If one is importable in this file (or a sibling already uses it), apply it at the route definition. Match the sibling route's style.
3. If no auth middleware exists yet, do NOT scaffold one — set `auto_fixable: false` via a confirmation that says "needs project-level auth middleware first." Open the issue for human review.
4. Preserve the handler body exactly. The only change is adding the middleware or Depends() call.

Env var / new import: likely none — auth middleware is usually already imported in the same module for other routes.
