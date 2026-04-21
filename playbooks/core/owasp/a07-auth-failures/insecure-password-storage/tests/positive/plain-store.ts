// Fixture: storing password directly from req.body. Should flag.
export async function signup(req: any) {
  await db.users.create({
    email: req.body.email,
    password: req.body.password,
  });
}
