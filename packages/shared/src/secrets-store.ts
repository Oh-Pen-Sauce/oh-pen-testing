import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Three-tier secrets store for Oh Pen Testing.
 *
 * Priority order when **reading**:
 *   1. Environment variable (highest — deliberate CI / Docker flow).
 *   2. OS keychain via `keytar` (native module).
 *   3. Local fallback file: ~/.ohpentesting/secrets.json (mode 0600,
 *      never inside a repo → never accidentally committed).
 *
 * When **writing**, we try keychain first. If it throws (native
 * module missing or the platform keyring service is broken) we
 * transparently fall back to the local file. No more asking users
 * to open a terminal and `export GITHUB_TOKEN=…`.
 *
 * Security note: the fallback file lives under the user's home
 * directory, chmod'd 0600. This is not as strong as the OS
 * keychain (which encrypts at rest and requires Touch ID / sudo on
 * macOS), but it's the same threat model as config.yml and the
 * user's own ~/.ssh/ — only the logged-in user can read it. We
 * never write it into the project's .ohpentesting/ directory,
 * which would risk a git-commit leak.
 */

export const KEYTAR_SERVICE = "oh-pen-testing";

/** Account names Oh Pen Testing uses inside the secrets store. */
export const SECRET_ACCOUNTS = {
  anthropic: "anthropic-api-key",
  openai: "openai-api-key",
  openrouter: "openrouter-api-key",
  github: "github-token",
  gitlab: "gitlab-token",
  bitbucket: "bitbucket-token",
} as const;

/** Which env var a given account falls back to (if any). */
const ENV_VAR_BY_ACCOUNT: Record<string, string> = {
  "anthropic-api-key": "ANTHROPIC_API_KEY",
  "openai-api-key": "OPENAI_API_KEY",
  "openrouter-api-key": "OPENROUTER_API_KEY",
  "github-token": "GITHUB_TOKEN",
  "gitlab-token": "GITLAB_TOKEN",
  "bitbucket-token": "BITBUCKET_TOKEN",
};

export type SecretStorageLocation = "env" | "keychain" | "file" | "missing";

export interface GetSecretResult {
  value: string | null;
  location: SecretStorageLocation;
}

function fallbackFilePath(): string {
  return path.join(os.homedir(), ".ohpentesting", "secrets.json");
}

// ─────── dynamic keytar loader ───────

/**
 * keytar is a native-module dep with notoriously flaky load behaviour
 * (arch mismatches, missing libsecret on Linux, permission dialogs).
 * We wrap every call in a try/catch and surface a nullable module so
 * callers can silently fall through to the file tier.
 */
async function loadKeytar(): Promise<{
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(
    service: string,
    account: string,
    password: string,
  ): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
} | null> {
  try {
    // Indirect dynamic import so TS doesn't pull keytar into the DTS
    // build graph when keytar isn't installed (e.g. in CI).
    const dynamicImport = new Function(
      "m",
      "return import(m)",
    ) as (m: string) => Promise<{
      default: {
        getPassword(service: string, account: string): Promise<string | null>;
        setPassword(
          service: string,
          account: string,
          password: string,
        ): Promise<void>;
        deletePassword(
          service: string,
          account: string,
        ): Promise<boolean>;
      };
    }>;
    const mod = await dynamicImport("keytar");
    return mod.default;
  } catch {
    return null;
  }
}

// ─────── file tier ───────

async function readFallbackFile(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(fallbackFilePath(), "utf-8");
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed;
  } catch {
    return {};
  }
}

async function writeFallbackFile(
  contents: Record<string, string>,
): Promise<void> {
  const filePath = fallbackFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  // Write atomic: tmp → rename, then chmod 0600.
  const tmp = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(contents, null, 2), {
    mode: 0o600,
    encoding: "utf-8",
  });
  await fs.rename(tmp, filePath);
  try {
    await fs.chmod(filePath, 0o600);
  } catch {
    // chmod can fail on Windows — the rename preserves mode from
    // writeFile so this is belt-and-braces only.
  }
}

// ─────── public API ───────

/**
 * Fetch a secret, walking env → keychain → file.
 * Returns { value: null } if none of the tiers have it.
 */
export async function getSecret(account: string): Promise<GetSecretResult> {
  const envVar = ENV_VAR_BY_ACCOUNT[account];
  if (envVar) {
    const fromEnv = process.env[envVar];
    if (fromEnv && fromEnv.length > 0) {
      return { value: fromEnv, location: "env" };
    }
  }

  const keytar = await loadKeytar();
  if (keytar) {
    try {
      const fromKeychain = await keytar.getPassword(KEYTAR_SERVICE, account);
      if (fromKeychain) {
        return { value: fromKeychain, location: "keychain" };
      }
    } catch {
      /* fall through */
    }
  }

  const file = await readFallbackFile();
  if (file[account]) {
    return { value: file[account], location: "file" };
  }

  return { value: null, location: "missing" };
}

export interface SetSecretResult {
  /** Where the secret ended up on disk. */
  location: "keychain" | "file";
  /** Plain-English description of the storage choice. */
  detail: string;
}

/**
 * Persist a secret. Tries the OS keychain first, falls back to
 * ~/.ohpentesting/secrets.json. Never needs the user to run `export`.
 */
export async function setSecret(
  account: string,
  value: string,
): Promise<SetSecretResult> {
  if (!value || value.length < 4) {
    throw new Error("Secret is empty or too short to persist.");
  }
  const keytar = await loadKeytar();
  if (keytar) {
    try {
      await keytar.setPassword(KEYTAR_SERVICE, account, value);
      return {
        location: "keychain",
        detail: "Saved to your OS keychain.",
      };
    } catch (err) {
      // Keychain refused the write (common on Linux without
      // libsecret). Quietly fall through to the file tier.
      // eslint-disable-next-line no-console
      console.warn(
        `[secrets-store] keytar.setPassword failed (${
          (err as Error).message
        }); falling back to ~/.ohpentesting/secrets.json`,
      );
    }
  }

  // Merge-and-rewrite the fallback file.
  const current = await readFallbackFile();
  current[account] = value;
  await writeFallbackFile(current);
  return {
    location: "file",
    detail: `Saved to ${fallbackFilePath()} (mode 0600, user-only).`,
  };
}

/**
 * Remove a secret from both tiers. No-op if the secret isn't present.
 */
export async function deleteSecret(account: string): Promise<void> {
  const keytar = await loadKeytar();
  if (keytar) {
    try {
      await keytar.deletePassword(KEYTAR_SERVICE, account);
    } catch {
      /* ignore */
    }
  }
  try {
    const current = await readFallbackFile();
    if (account in current) {
      delete current[account];
      await writeFallbackFile(current);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Diagnostic — check where a secret currently lives without returning
 * its value. Used by the CLI `opt connect` flow to tell the user
 * "saved to keychain" vs "saved to ~/.ohpentesting/secrets.json".
 */
export async function locateSecret(
  account: string,
): Promise<SecretStorageLocation> {
  const result = await getSecret(account);
  return result.location;
}

/**
 * Check whether the fallback file exists + is 0600. Returns a
 * human-readable sentence for UI surfaces that want to show "where
 * are my secrets". Never returns the values themselves.
 */
export async function fallbackFileStatus(): Promise<{
  path: string;
  exists: boolean;
  mode?: number;
  warning?: string;
}> {
  const p = fallbackFilePath();
  try {
    const st = await fs.stat(p);
    const mode = st.mode & 0o777;
    let warning: string | undefined;
    if ((mode & 0o077) !== 0) {
      warning = `File is mode 0${mode.toString(8)} — should be 0600.`;
    }
    // Explicit access check: the process must still be able to read it.
    await fs.access(p, fsConstants.R_OK);
    return { path: p, exists: true, mode, warning };
  } catch {
    return { path: p, exists: false };
  }
}
