## Playbook: cors-wildcard (remediate)

Replace the wildcard with an explicit allowlist read from environment or config.

Pattern:
```
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") ?? [];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("origin not allowed"));
  },
  credentials: true,
}));
```

Env var: `ALLOWED_ORIGINS` (comma-separated). `env_example_addition` should read `ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com`.

Explanation points to include:
- Wildcard + credentials is rejected by browsers but older clients/servers sometimes permit.
- Reflecting Origin without validation is equivalent to no CORS protection.
- Allowlist makes policy explicit and auditable.
