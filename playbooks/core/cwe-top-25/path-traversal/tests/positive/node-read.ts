import fs from "node:fs";
import path from "node:path";
export function serveFile(req: any, res: any) {
  const file = path.join("/var/data", req.query.name);
  const content = fs.readFileSync(file, "utf-8");
  res.send(content);
}
