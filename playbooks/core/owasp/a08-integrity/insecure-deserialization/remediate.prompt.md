## Playbook: insecure-deserialization (remediate)

Switch to a safe format / safe variant:

- `pickle.loads(x)` → JSON (`json.loads(x)`) if the data doesn't need Python objects; otherwise use a typed schema library (`pydantic.BaseModel.parse_raw`).
- `yaml.load(x)` → `yaml.safe_load(x)`. If you need custom tags, define a SafeLoader subclass explicitly.
- `eval(x)` → never. For arithmetic use `ast.literal_eval` (Python) or `Number(x)` + validation (JS). For config use JSON.
- `unserialize(x)` (node-serialize) → drop the dependency. Use JSON + explicit schema validation.

Never "sanitise" untrusted input to a serialisation format — the format itself is the vulnerability.

`env_var_name`: none.
