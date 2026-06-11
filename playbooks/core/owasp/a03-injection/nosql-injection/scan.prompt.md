## Playbook: owasp/a03-injection/nosql-injection (scan)

Confirm when raw request input reaches a MongoDB/Mongoose query in a form that lets the client inject query operators. The classic shapes are `Model.find(req.query)`, `collection.findOne({ user: req.body.user, pass: req.body.pass })` where the values are raw objects, and any `$where` clause built from user input.

Do NOT confirm when:
- The value is cast or validated to a scalar first, e.g. `findById(String(req.params.id))`, `findOne({ email: validatedEmail })`, or a value run through a schema/validator (Joi, Zod, express-validator) before the query.
- The filter is a literal object with no `req.*` inside it.
- A sanitiser such as `mongo-sanitize` or `express-mongo-sanitize` strips `$`-prefixed keys upstream and that is visible in context.

Severity:
- critical: authentication or authorisation filter (login, password reset, ownership check) takes a raw request object, so `{"$ne": null}` bypasses it.
- high: a data-read or update query takes a raw request object but is not an auth gate.
- medium: a `$where` clause from user input that is hard to reach or already partially validated.
