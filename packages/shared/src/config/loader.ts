import fs from "node:fs/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { ConfigError, ConfigSchema, type Config } from "./schema.js";
import { ohpenPaths } from "../paths.js";

export async function loadConfig(cwd: string): Promise<Config> {
  const paths = ohpenPaths(cwd);
  let raw: string;
  try {
    raw = await fs.readFile(paths.config, "utf-8");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      throw new ConfigError(
        `No .ohpentesting/config.yml found in ${cwd}. Run \`oh-pen-testing init\` first.`,
      );
    }
    throw new ConfigError(`Failed to read config: ${e.message}`);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    throw new ConfigError(
      `Config is not valid YAML: ${(err as Error).message}`,
    );
  }

  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigError(
      `Config validation failed`,
      result.error.flatten(),
    );
  }
  return result.data;
}

export async function writeConfig(cwd: string, config: Config): Promise<void> {
  const paths = ohpenPaths(cwd);
  const yaml = stringifyYaml(config, { indent: 2 });
  await fs.writeFile(paths.config, yaml, "utf-8");
}

export function resolveOhpenDir(cwd: string): string {
  return ohpenPaths(cwd).root;
}
