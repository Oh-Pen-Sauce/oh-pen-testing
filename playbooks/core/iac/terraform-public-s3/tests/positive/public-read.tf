resource "aws_s3_bucket" "user_uploads" {
  bucket = "acme-user-uploads"
}

resource "aws_s3_bucket_acl" "user_uploads" {
  bucket = aws_s3_bucket.user_uploads.id
  acl    = "public-read"
}
