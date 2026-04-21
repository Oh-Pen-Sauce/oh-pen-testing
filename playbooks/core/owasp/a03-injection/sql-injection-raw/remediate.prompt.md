## Playbook: sql-injection-raw (remediate)

Parameterise. Do NOT sanitise-by-escaping.

- Node (most drivers): `db.query("SELECT * FROM users WHERE email = $1", [email])` or the driver-specific `?` positional form.
- Python (psycopg2): `cursor.execute("SELECT * FROM users WHERE email = %s", (email,))` — note the trailing tuple.
- Python (SQLAlchemy): `db.execute(text("... :email ..."), {"email": email})`.
- Knex/Prisma: use the query builder methods (`.where()`, `.select()`) instead of `.raw()`.

For identifiers (table/column names) that can't be parameters, keep the original value but gate it with an allowlist check first.

`env_var_name`: none.
