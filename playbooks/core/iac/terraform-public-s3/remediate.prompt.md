## Playbook: iac/terraform-public-s3 (remediate)

Replace public ACLs with a locked-down block-public-access configuration:

```hcl
resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

If the bucket must serve public assets, front it with CloudFront using
an Origin Access Control (OAC) and keep the bucket itself private.

If the bucket policy uses `"Principal": "*"`, rewrite it to grant
access only to the specific role, service principal, or OAC that
legitimately needs it.

Do not delete the bucket or change its name — just tighten the
permissions. Preserve any `tags`, `versioning`, and `server_side_encryption`
blocks untouched.
