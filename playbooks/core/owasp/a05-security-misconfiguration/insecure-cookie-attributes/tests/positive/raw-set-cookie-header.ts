import type { ServerResponse } from 'http';

// A hand-written Set-Cookie header for the session token with no HttpOnly and
// no Secure flag, so the token is exposed to script and to plain HTTP.
export function issueSession(res: ServerResponse, token: string): void {
  res.setHeader('Set-Cookie', `session=${token}; Path=/; SameSite=Lax`);
  res.statusCode = 204;
  res.end();
}
