## Playbook: debug-mode-enabled (remediate)

Move the flag behind an env var and default false.

- Django: `DEBUG = os.environ.get("DJANGO_DEBUG", "").lower() == "true"`
- Flask: `app.debug = os.environ.get("FLASK_DEBUG", "").lower() == "true"`
- Node error handler: strip `err.stack` from the response in production (`process.env.NODE_ENV !== "development"`).

`env_var_name`: `DJANGO_DEBUG` / `FLASK_DEBUG` (pick the one that matches the framework).
`env_example_addition`: `DJANGO_DEBUG=false` (etc).
