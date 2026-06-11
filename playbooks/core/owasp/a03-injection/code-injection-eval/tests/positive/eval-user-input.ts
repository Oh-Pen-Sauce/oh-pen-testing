export function run(req: { body: { code: string } }) {
  // Runtime code injection: eval on attacker-controlled input.
  return eval(req.body.code);
}
