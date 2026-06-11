// Fixture: shallow spread into a fresh object literal. Must NOT flag.
export function withDefaults<T extends object>(defaults: T, safeOptions: Partial<T>): T {
  const merged = { ...defaults, ...safeOptions };
  return merged;
}
