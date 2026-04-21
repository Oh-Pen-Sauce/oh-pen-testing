// Fixture: parameterised query. Must NOT flag.
import { db } from "./db";

export async function findUser(email: string) {
  return db.query("SELECT * FROM users WHERE email = $1", [email]);
}
