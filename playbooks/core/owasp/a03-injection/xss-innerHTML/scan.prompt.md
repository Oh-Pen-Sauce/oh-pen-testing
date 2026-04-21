## Playbook: xss-innerhtml (scan)

Confirm when the assigned value:
- Comes from user input (form field, URL param, fetch response without strict schema).
- Comes from markdown / rich-text rendered without an HTML sanitiser (DOMPurify, bleach, xss-filters).
- Is assembled via template literals that interpolate any variable.

Do NOT confirm when:
- The value is a literal string constant or an import from a trusted static asset.
- The value is already passed through a sanitiser whose import is visible in context (DOMPurify, sanitize-html, bleach).

Severity:
- `critical` — user input without sanitisation.
- `high` — third-party content without sanitisation.
- `medium` — template literal without clearly-safe inputs.
