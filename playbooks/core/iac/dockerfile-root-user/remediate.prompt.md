## Playbook: iac/dockerfile-root-user (remediate)

Add a dedicated non-root user and switch to it *before* CMD/ENTRYPOINT:

```dockerfile
RUN addgroup -S app && adduser -S app -G app
USER app
```

(Alpine syntax — use `groupadd`/`useradd` on Debian-derived images.)

Pre-existing `USER root` lines should be deleted, not commented out. Any
files the non-root user needs to write to (log directories, cache paths)
should have ownership chowned during build — don't weaken security by
running `chmod 777` everywhere.

If sudo was installed only to grant passwordless root to the app user,
remove the `sudo` install entirely.
