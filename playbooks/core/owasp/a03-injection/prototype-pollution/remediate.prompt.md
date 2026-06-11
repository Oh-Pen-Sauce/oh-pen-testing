## Playbook: prototype-pollution (remediate)

Preferred fixes in order:
1. Reject dangerous keys before any write or merge. Skip `__proto__`, `constructor`, and `prototype`:
   ```
   if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
   ```
2. Use a null-prototype container so there is no prototype to pollute: `Object.create(null)`, or a `Map` keyed by string.
3. Use a merge library version that is patched against pollution and pass an allow-list of expected keys. Avoid recursively merging raw request bodies; validate the body against a schema (zod, ajv, pydantic) first and merge only the typed result.
4. For Python, do the same: in any recursive merge, skip keys named `__proto__`, `__class__`, or `__dict__`, and prefer building a new dict from validated fields over mutating an existing one.

`env_var_name`: none.
