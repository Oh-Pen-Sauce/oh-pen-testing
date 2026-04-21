## Playbook: unrestricted-upload (remediate)

Add a `fileFilter` (multer) that checks MIME + extension allowlist AND a `limits.fileSize`. Serve uploaded files from a separate origin (e.g. S3 presigned URL) — never the same origin as the application.
