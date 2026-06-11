## Playbook: prototype-pollution (scan)

Confirm when:
- A `__proto__` or `constructor.prototype` key is written with a value or a sub-key that is not a hard-coded literal, especially when the key itself comes from a variable (`target['__proto__'][userKey] = value`).
- A deep-merge, extend, or defaultsDeep helper merges request data (`req.body`, `req.query`, `request.json`, a parsed JSON payload) into an existing object, and that helper recurses into nested keys.
- A hand-rolled recursive merge copies keys from an untrusted source into a target without rejecting `__proto__`, `constructor`, or `prototype`.

Do NOT confirm when:
- The merge target is a fresh empty object or literal (`_.merge({}, defaults, fallback)`, `Object.assign({}, a, b)`) and no untrusted source feeds it.
- The construct is a read or comparison rather than a write (`if (obj.__proto__ === Array.prototype)`, `Object.getPrototypeOf(obj)`).
- The source object is a static, in-repo constant with no user-controlled keys.
- The merge helper is known to drop dangerous keys (a sanitised merge, or a Map rather than a plain object).

Severity:
- `critical`: untrusted request data deep-merged into a shared or long-lived object.
- `high`: direct write through `__proto__` / `constructor.prototype` reachable from user input.
- `medium`: deep merge of third-party data into a per-request object with limited blast radius.
