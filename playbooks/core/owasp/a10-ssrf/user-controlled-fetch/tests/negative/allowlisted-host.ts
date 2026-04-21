// Fixture: fetch with allowlist check. Must NOT flag.
const ALLOWED = (process.env.FETCH_ALLOWED_HOSTS ?? "").split(",");
export async function safeFetch(urlStr: string) {
  const url = new URL(urlStr);
  if (!ALLOWED.includes(url.host)) throw new Error("host not allowed");
  return fetch(url.toString());
}
