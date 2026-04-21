// Fixture: bcrypt-based comparison. Must NOT flag.
import bcrypt from "bcrypt";
export async function login(req: any) {
  const user = await db.users.findByEmail(req.body.email);
  const ok = await bcrypt.compare(req.body.password, user.passwordHash);
  return { ok };
}
