import fs from "node:fs";
import path from "node:path";
const BASE = "/var/data";
export function serveFile(req: any, res: any) {
  const candidate = path.resolve(BASE, req.query.name ?? "");
  if (!candidate.startsWith(BASE + path.sep)) return res.status(403).end();
  res.send(fs.readFileSync(candidate, "utf-8"));
}
