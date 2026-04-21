// Must NOT flag: allowlist + startsWith check.
const ALLOWED = ["/dashboard", "/onboarding"];
export function afterLogin(req: any, res: any) {
  const target = String(req.query.next ?? "/");
  if (!ALLOWED.includes(target) && !target.startsWith("/")) return res.redirect("/");
  res.redirect(target);
}
