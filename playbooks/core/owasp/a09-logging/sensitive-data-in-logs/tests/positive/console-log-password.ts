// Fixture: console.log with password field. Should flag.
export function handleLogin(req: any) {
  console.log("login attempt", { email: req.body.email, password: req.body.password });
}
