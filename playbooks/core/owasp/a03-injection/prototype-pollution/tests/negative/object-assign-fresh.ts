// Fixture: Object.assign onto a fresh literal target. Must NOT flag.
export function combine<A extends object, B extends object>(a: A, b: B): A & B {
  return Object.assign({}, a, b) as A & B;
}
