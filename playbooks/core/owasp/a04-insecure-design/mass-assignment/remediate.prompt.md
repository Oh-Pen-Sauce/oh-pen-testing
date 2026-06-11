## Playbook: owasp/a04-insecure-design/mass-assignment (remediate)

Never bind the raw request body onto a model. Pick the fields the route is allowed to set, so privilege and ownership columns stay off the wire.

Allow-list the inputs explicitly:
```
const data = {
  name: req.body.name,
  email: req.body.email,
};
const user = await User.create(data);
```

Or pick a fixed set of keys before binding:
```
import { pick } from 'lodash';
const data = pick(req.body, ['name', 'email']);
Object.assign(user, data);
await user.save();
```

For larger payloads, validate into a typed DTO (zod, class-validator) whose schema lists only the permitted fields, then pass the parsed object. Fields like role, isAdmin, isVerified, ownerId, and balance must be set by server logic, never copied from the body.
