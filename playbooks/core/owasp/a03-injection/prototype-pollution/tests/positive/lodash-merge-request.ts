// Fixture: deep-merging untrusted request body into an existing object. Should flag.
import _ from 'lodash';

export function applySettings(config: Record<string, unknown>, req: { body: unknown }) {
  return _.merge(config, req.body);
}
