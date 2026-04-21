## Playbook: weak-password-policy (remediate)

Raise to at least 8 chars. 12 is a better default for modern services. If the codebase has a consistent auth-policy module, add the constant there; don't duplicate.

Update both client-side form validation AND server-side schema — never one without the other.

`env_var_name`: none.
