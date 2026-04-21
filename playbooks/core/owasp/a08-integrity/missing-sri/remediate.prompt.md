## Playbook: missing-sri (remediate)

Add `integrity="sha384-..."` and `crossorigin="anonymous"`.

```html
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-..."
  crossorigin="anonymous"></script>
```

Generate the hash with `openssl dgst -sha384 -binary lib.js | openssl base64 -A`.

For CDNs like jsDelivr / unpkg / Cloudflare, the CDN usually provides the hash — search their docs. If the resource changes often, consider self-hosting.

`env_var_name`: none.
