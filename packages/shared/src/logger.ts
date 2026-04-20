import fs from "node:fs/promises";
import path from "node:path";
import { ohpenPaths } from "./paths.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEvent {
  level: LogLevel;
  event: string;
  msg?: string;
  [k: string]: unknown;
}

export interface Logger {
  debug(event: string, data?: Record<string, unknown>): void;
  info(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
  close(): Promise<void>;
}

export async function createLogger(
  cwd: string,
  scanId: string,
): Promise<Logger> {
  const { logs } = ohpenPaths(cwd);
  await fs.mkdir(logs, { recursive: true });
  const file = path.join(logs, `${scanId}.jsonl`);
  const handle = await fs.open(file, "a");

  const pretty = process.env.OHPEN_LOG_PRETTY === "1";

  const log = (level: LogLevel, event: string, data?: Record<string, unknown>) => {
    const record: LogEvent = {
      level,
      event,
      ts: new Date().toISOString(),
      ...(data ?? {}),
    };
    handle.appendFile(JSON.stringify(record) + "\n").catch(() => {
      // swallow — logger must not crash the scanner
    });
    if (pretty) {
      const tag = `[${level.toUpperCase()}]`;
      // eslint-disable-next-line no-console
      console.log(`${tag} ${event}`, data ? JSON.stringify(data) : "");
    }
  };

  return {
    debug: (e, d) => log("debug", e, d),
    info: (e, d) => log("info", e, d),
    warn: (e, d) => log("warn", e, d),
    error: (e, d) => log("error", e, d),
    close: async () => {
      await handle.close();
    },
  };
}

export function createNoopLogger(): Logger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    close: async () => {},
  };
}
