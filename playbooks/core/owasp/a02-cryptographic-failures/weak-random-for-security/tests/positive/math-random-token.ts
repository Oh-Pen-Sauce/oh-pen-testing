// Fixture: Math.random() in a session token generator. Should flag.
export function generateSessionToken(): string {
  const token = Math.random().toString(36).slice(2);
  return token;
}
