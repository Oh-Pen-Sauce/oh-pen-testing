Replace the dynamic `eval` / `new Function` with a safe alternative:

- Parsing data: use `JSON.parse` for JSON, or a real parser for the format.
- Looking up behaviour by name: use an explicit allow-list object or `Map` keyed by the input, never code built from the input.
- Computing expressions: use a sandboxed expression evaluator with no host access, or a small purpose-built parser.

Never reintroduce execution of a string derived from external input. Keep the change minimal and preserve the surrounding behaviour.
