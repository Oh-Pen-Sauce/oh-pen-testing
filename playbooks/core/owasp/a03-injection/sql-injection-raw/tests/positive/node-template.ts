// Fixture: template literal SQL. Should flag.
import { db } from "./db";

export async function findUser(email: string) {
  return db.query(`SELECT * FROM users WHERE email = '${email}'`);
}
