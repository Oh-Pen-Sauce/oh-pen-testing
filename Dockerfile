# Oh Pen Testing: all-in-one container
#
# Ships the CLI and the web UI. Mount your project at /workspace and the
# container will read/write .ohpentesting/ there. Defaults to serving the
# web UI on :7676; override the entrypoint to run the CLI instead.
#
#   docker run --rm -it \
#     -v "$PWD":/workspace -w /workspace \
#     ghcr.io/oh-pen-sauce/oh-pen-testing:latest \
#     opt scan
#
FROM node:22-alpine AS build
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Dependency install: copy manifests first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY playbooks/ ./playbooks/
RUN pnpm install --frozen-lockfile

# Build everything
RUN pnpm turbo run build

# ------------- runtime image -------------
FROM node:22-alpine

# git is needed for the blame timeline + any git-based scanner steps
RUN apk add --no-cache git

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Non-root user
RUN addgroup -S opt && adduser -S opt -G opt
WORKDIR /home/opt

COPY --from=build --chown=opt:opt /app /home/opt/app

# CLI shim: put `opt` and `oh-pen-testing` on PATH. Symlinks are created as
# root (before dropping to the unprivileged user). The bin is the tsup output
# at packages/cli/dist/index.js, which carries its own shebang.
RUN chmod +x /home/opt/app/packages/cli/dist/index.js \
 && ln -sf /home/opt/app/packages/cli/dist/index.js /usr/local/bin/opt \
 && ln -sf /home/opt/app/packages/cli/dist/index.js /usr/local/bin/oh-pen-testing

USER opt
WORKDIR /workspace
EXPOSE 7676

# Default: serve the web UI on all interfaces so it is reachable from the host.
# Override with `opt <command>` to run the CLI instead.
CMD ["sh", "-c", "cd /home/opt/app/packages/web && exec pnpm exec next start -H 0.0.0.0 -p 7676"]
