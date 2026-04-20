# Secrets detection patterns

This document describes the patterns the scanner looks for. It intentionally
uses placeholder descriptions rather than real-looking values, so the scanner
must NOT flag it.

- AWS Access Key IDs start with the prefix AKIA followed by sixteen
  uppercase letters and digits. Example (do not paste real ones): use a
  string like that.
- GitHub PATs start with ghp_ followed by a long random string.
- Slack tokens have prefixes like xoxb- or xoxp-.
- Private keys begin with a PEM header line.

If you see matching literals in source code, you should refactor them to
environment variables.
