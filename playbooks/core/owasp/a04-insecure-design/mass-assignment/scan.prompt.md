## Playbook: owasp/a04-insecure-design/mass-assignment (scan)

Confirm when an untrusted request body (`req.body`, `req.query`, `req.params`, or the framework equivalent) is bound onto a model, entity, or persistence call without an explicit field allow-list:

- A model constructor or `create` / `update` / `findByIdAndUpdate` / `updateOne` receives `req.body` directly as the data argument.
- `Object.assign(entity, req.body)` copies every body key onto a loaded record.
- A repository `.save(req.body)` or `.insert(req.body)` persists the raw body.
- The whole body is spread (`{ ...req.body }`) into the data object of a create or update.

Do NOT confirm when the code picks fields explicitly, for example `Model.create({ name: req.body.name, email: req.body.email })`, `Object.assign(entity, pick(req.body, ['name', 'email']))`, a validated DTO whose shape is enforced before the call, or a create from a hard-coded literal object with no untrusted source.

Severity:
- critical: the model exposes a privilege or ownership field (role, isAdmin, isVerified, ownerId, balance) that the route does not otherwise guard.
- high: the whole body is bound and the model has writable fields beyond what the form should set.
- medium: binding is broad but the model only holds low-impact fields, or a partial guard exists upstream.
