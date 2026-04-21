## Playbook: default-credentials (remediate)

Replace the literal with an env var lookup that fails loudly if unset.

- Node: `const password = process.env.ADMIN_PASSWORD; if (!password) throw new Error("ADMIN_PASSWORD must be set");`
- Python: `password = os.environ["ADMIN_PASSWORD"]` (dict lookup raises KeyError).

If this is a DB seed / init script, the fix is to generate the password randomly AND print it to the operator once, so nobody ever ships with the default.

`env_var_name`: `ADMIN_PASSWORD` (or whatever fits the variable's role).
`env_example_addition`: `ADMIN_PASSWORD=set-a-real-one`.
