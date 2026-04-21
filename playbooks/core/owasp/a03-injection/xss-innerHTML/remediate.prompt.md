## Playbook: xss-innerhtml (remediate)

Preferred fixes in order:
1. Replace with text-node assignment: `el.textContent = value` — no HTML parsing at all.
2. If HTML is genuinely needed, sanitise first with DOMPurify:
   ```
   import DOMPurify from "dompurify";
   el.innerHTML = DOMPurify.sanitize(value);
   ```
3. For React: replace `dangerouslySetInnerHTML={{__html: value}}` with plain JSX `{value}` if it's text, or the DOMPurify pattern if HTML is required.
4. For `document.write` — replace with explicit DOM APIs (`createElement`, `appendChild`).

`env_var_name`: none.
