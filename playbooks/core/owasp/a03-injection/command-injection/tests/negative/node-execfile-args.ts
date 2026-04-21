// Fixture: execFile with array args, no shell. Must NOT flag.
import { execFile } from "node:child_process";

export function cloneRepo(url: string) {
  execFile("git", ["clone", url, "/tmp/repo"], (err) => {
    if (err) throw err;
  });
}
