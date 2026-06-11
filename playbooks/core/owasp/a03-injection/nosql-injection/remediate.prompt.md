## Playbook: owasp/a03-injection/nosql-injection (remediate)

Never pass a raw request object into a query. Cast each value to the scalar type you expect, and build the filter from those scalars.

```js
// Vulnerable: {"$ne": null} bypasses the password check.
const user = await User.findOne({ email: req.body.email, password: req.body.password });

// Fixed: cast to strings, so an injected operator object becomes a harmless string.
const email = String(req.body.email);
const password = String(req.body.password);
const user = await User.findOne({ email, password });
```

For ids use `String(req.params.id)` (or `mongoose.Types.ObjectId.isValid` then construct the ObjectId). Validate the whole body with a schema (Zod, Joi, express-validator) so it can only ever be the scalars you want. Drop `$where` entirely; rewrite the condition as a normal filter or do it in application code. As defence in depth, mount `express-mongo-sanitize` to strip `$`-prefixed keys from req.body, req.query, and req.params.

`env_var_name`: none.
