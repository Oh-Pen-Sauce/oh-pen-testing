// Fixture: JSON.parse with literal. Must NOT flag (no eval, no unserialize).
export function parseDefaultConfig() {
  return JSON.parse('{"theme":"light"}');
}
