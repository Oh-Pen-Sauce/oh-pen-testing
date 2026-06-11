// Fixture: jwt.verify restricted to RS256. Must NOT flag.
import jwt from "jsonwebtoken";

export function checkToken(token: string, secret: string): object | string {
  return jwt.verify(token, secret, { algorithms: ["RS256"] });
}
