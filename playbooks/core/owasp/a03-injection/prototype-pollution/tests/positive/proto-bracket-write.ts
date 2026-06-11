// Fixture: writing through a bracketed __proto__ key. Should flag.
export function assign(target: Record<string, unknown>, userKey: string, value: unknown) {
  target['__proto__'][userKey] = value;
}
