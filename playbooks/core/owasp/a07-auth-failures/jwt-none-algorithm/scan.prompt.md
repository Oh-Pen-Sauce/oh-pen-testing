## Playbook: jwt-none-algorithm (scan)

Confirm when the match:
- Sets the signing or verification algorithm to `none` on a real JWT call (`jwt.sign`, `jwt.encode`, `jwt.verify`, `jwt.decode`, or a library wrapper).
- Lists `none` among accepted `algorithms` on a verify/decode path, even alongside real algorithms. One accepted `none` is enough to forge tokens.
- Reaches the JWT library through an options variable assembled nearby (`const opts = { algorithm: "none" }`).

Do NOT confirm when:
- The string `none` is unrelated to JWT (a CSS value, an enum, a config flag for some other feature).
- It is a test fixture or comment that deliberately documents the unsafe case and never reaches production signing or verification.
- The literal sits in a denylist that rejects `none`, for example a guard that throws when the algorithm equals `none`.

Severity:
- `critical`: `none` accepted on a verification path (`jwt.verify` / `jwt.decode`); attackers can forge any token.
- `high`: `none` used when signing; tokens this service issues carry no integrity protection.
