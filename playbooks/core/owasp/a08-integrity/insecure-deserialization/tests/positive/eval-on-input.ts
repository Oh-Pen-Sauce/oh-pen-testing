// Fixture: eval on variable. Should flag.
export function computeExpression(req: { body: { expr: string } }) {
  return eval(req.body.expr);
}
