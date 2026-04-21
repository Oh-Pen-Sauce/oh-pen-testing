import path from "node:path";

export const OHPEN_DIR = ".ohpentesting";

export const ohpenPaths = (repoRoot: string) => ({
  root: path.join(repoRoot, OHPEN_DIR),
  config: path.join(repoRoot, OHPEN_DIR, "config.yml"),
  issues: path.join(repoRoot, OHPEN_DIR, "issues"),
  scans: path.join(repoRoot, OHPEN_DIR, "scans"),
  reports: path.join(repoRoot, OHPEN_DIR, "reports"),
  logs: path.join(repoRoot, OHPEN_DIR, "logs"),
  playbooksLocal: path.join(repoRoot, OHPEN_DIR, "playbooks", "local"),
  playbooksRemote: path.join(repoRoot, OHPEN_DIR, "playbooks", "remote"),
  counter: path.join(repoRoot, OHPEN_DIR, ".counter.json"),
  gitignore: path.join(repoRoot, OHPEN_DIR, ".gitignore"),
});

export type OhpenPaths = ReturnType<typeof ohpenPaths>;
