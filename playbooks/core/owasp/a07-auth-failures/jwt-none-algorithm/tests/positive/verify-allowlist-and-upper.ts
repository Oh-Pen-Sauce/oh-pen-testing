import jwt from "jsonwebtoken";

// Algorithm confusion: "none" allow-listed alongside a real algorithm.
// This is the canonical bypass and must be flagged even though "none"
// is not the first list entry.
export function check(token: string, key: string) {
  return jwt.verify(token, key, { algorithms: ["RS256", "none"] });
}

// Uppercase NONE is accepted by several libraries and must also flag.
export const opts = { algorithm: "NONE" };
