import type { ServerResponse } from 'http';

// Safe near-miss: the Set-Cookie header carries the full hardening flags, so the
// session token is HttpOnly, Secure, and SameSite strict.
export function issueSession(res: ServerResponse, token: string): void {
  res.setHeader(
    'Set-Cookie',
    `session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict`,
  );
  res.statusCode = 204;
  res.end();
}
