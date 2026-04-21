// Fixture: plaintext password comparison. Should flag.
export async function login(req: any) {
  const user = await db.users.findByEmail(req.body.email);
  if (user.password === req.body.password) {
    return { ok: true };
  }
  return { ok: false };
}
