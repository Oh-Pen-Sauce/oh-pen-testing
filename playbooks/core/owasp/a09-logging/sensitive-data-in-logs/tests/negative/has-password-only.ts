// Fixture: logs only presence, not value. Must NOT flag.
export function handleLogin(req: any) {
  const hasCredentials = Boolean(req.body.email);
  console.log("login attempt", { email: req.body.email, hasCredentials });
}
