## Playbook: iac/dockerfile-root-user (scan)

A Dockerfile either explicitly runs the final process as `root` / `UID 0`,
or installs `sudo` into the image. Confirm whether the image needs
root for runtime.

Severity:
- high — long-running service (web server, worker) running as root
- medium — build-time tool images, but still production-facing
- low — short-lived CI images that never leave the build sandbox

Note: many base images (`nginx`, `postgres`) drop privileges internally
even when USER is not set — don't flag those unless the Dockerfile
overrides the default entrypoint.
