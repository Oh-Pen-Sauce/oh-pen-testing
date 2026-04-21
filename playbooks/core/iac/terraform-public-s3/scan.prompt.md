## Playbook: iac/terraform-public-s3 (scan)

An `aws_s3_bucket`, `aws_s3_bucket_acl`, or policy has been detected
with world-readable / world-writable configuration. Confirm whether
the bucket is intentionally a public static-asset host (logos, marketing
PDFs) or an accidental exposure of application data.

Severity:
- critical — regex hit + directory name suggests user uploads, exports,
  backups, or application data
- high — public bucket with no obvious "public-assets" naming hint
- medium — clearly a static-asset bucket (name includes `public-`,
  `assets-`, `cdn-`, etc.); still worth flagging but low confidence

Ignore cases where the resource is clearly a fronted CloudFront origin
*and* the bucket is locked down via OAI / OAC — that's the idiomatic
AWS pattern for static hosting.
