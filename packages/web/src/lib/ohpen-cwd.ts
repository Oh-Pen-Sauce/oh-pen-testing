export function getOhpenCwd(): string {
  return process.env.OHPEN_CWD ?? process.cwd();
}
