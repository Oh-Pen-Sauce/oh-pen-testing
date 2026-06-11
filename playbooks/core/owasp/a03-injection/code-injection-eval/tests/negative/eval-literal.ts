export function calc() {
  // A string literal is not attacker-controlled; the AST check ignores it.
  return eval("1 + 1");
}
