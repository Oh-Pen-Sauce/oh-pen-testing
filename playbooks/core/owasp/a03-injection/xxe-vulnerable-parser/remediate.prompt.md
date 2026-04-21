## Playbook: xxe-vulnerable-parser (remediate)

- Python lxml: replace with `defusedxml.lxml.fromstring(...)` or create an `XMLParser(resolve_entities=False, no_network=True)`.
- Python ElementTree: use `defusedxml.ElementTree` as a drop-in replacement.
- Node libxmljs: set `noent: false` (or prefer `fast-xml-parser` with no entity resolution).
- Java DocumentBuilderFactory: call:
  ```
  factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
  factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
  factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
  ```

`env_var_name`: none.
