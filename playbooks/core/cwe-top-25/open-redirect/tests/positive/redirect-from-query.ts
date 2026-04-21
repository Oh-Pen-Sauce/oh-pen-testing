// Should flag: redirect target from user input without allowlist.
export function afterLogin(req: any, res: any) {
  res.redirect(req.query.next);
}
