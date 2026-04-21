// Fixture: exec with template literal from req. Should flag.
import { exec } from "node:child_process";

export function cloneRepo(url: string) {
  exec(`git clone ${url} /tmp/repo`, (err) => {
    if (err) throw err;
  });
}
