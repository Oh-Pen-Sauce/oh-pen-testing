## Playbook: user-controlled-fetch (remediate)

Validate the URL and allowlist the host.

```
const ALLOWED = (process.env.FETCH_ALLOWED_HOSTS ?? "").split(",");
function safeFetch(urlStr: string) {
  const url = new URL(urlStr);
  if (!ALLOWED.includes(url.host)) throw new Error("host not allowed");
  // also reject private IP ranges — 10.0.0.0/8, 172.16.0.0/12,
  // 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16 — if resolved.
  return fetch(url.toString());
}
```

For Python, use `urllib.parse.urlparse` + the same allowlist check before passing to `requests`.

`env_var_name`: `FETCH_ALLOWED_HOSTS`.
`env_example_addition`: `FETCH_ALLOWED_HOSTS=api.github.com,api.example.com`.
