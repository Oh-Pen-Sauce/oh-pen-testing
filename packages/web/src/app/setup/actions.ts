"use server";

import { revalidatePath } from "next/cache";
import {
  loadConfig,
  ConfigSchema,
  writeConfig,
  buildDefaultConfig,
  setSecret,
  type SetSecretResult,
  type AutonomyMode,
  type ProviderId,
} from "@oh-pen-testing/shared";
import { getOhpenCwd } from "../../lib/ohpen-cwd";
import {
  detectClaudeCliInstalled,
  type ClaudeCliDetection,
} from "@oh-pen-testing/providers-claude-code-cli";
import {
  detectOllamaReachable,
  DEFAULT_OLLAMA_BASE_URL,
} from "@oh-pen-testing/providers-ollama";

export async function setProviderAction(provider: ProviderId, model?: string) {
  const cwd = getOhpenCwd();
  let current;
  try {
    current = await loadConfig(cwd);
  } catch {
    current = buildDefaultConfig({
      projectName: cwd.split("/").pop() ?? "unnamed",
      languages: ["generic"],
    });
  }
  current.ai.primary_provider = provider;
  if (model) current.ai.model = model;
  const validated = ConfigSchema.parse(current);
  await writeConfig(cwd, validated);
  revalidatePath("/setup");
}

export async function probeProviderAction(
  provider: ProviderId,
): Promise<{ ok: boolean; detail: string }> {
  if (provider === "claude-code-cli") {
    const res: ClaudeCliDetection = await detectClaudeCliInstalled();
    return {
      ok: res.installed,
      detail: res.installed
        ? `Installed at ${res.path ?? "(path unknown)"} (version ${res.version ?? "?"})`
        : `Not found on PATH. Error: ${res.error ?? "unknown"}`,
    };
  }
  if (provider === "ollama") {
    const ok = await detectOllamaReachable();
    return {
      ok,
      detail: ok
        ? `Ollama reachable at ${DEFAULT_OLLAMA_BASE_URL}`
        : `Ollama unreachable at ${DEFAULT_OLLAMA_BASE_URL}. Start it with \`ollama serve\`.`,
    };
  }
  // API-key providers: no probe — just confirm ready
  return { ok: true, detail: "Ready. You'll enter the API key in the next step." };
}

export async function saveApiKeyAction(
  providerId: ProviderId,
  secret: string,
): Promise<SetSecretResult> {
  const account =
    providerId === "claude-api" || providerId === "claude-max"
      ? "anthropic-api-key"
      : providerId === "openai"
        ? "openai-api-key"
        : providerId === "openrouter"
          ? "openrouter-api-key"
          : "unknown";
  if (account === "unknown") {
    throw new Error(`Provider ${providerId} does not use an API key.`);
  }
  if (!secret || secret.length < 10) {
    throw new Error("API key looks invalid (too short).");
  }
  // setSecret walks the tiers — keychain first, local file fallback,
  // never forces the user to open a terminal and `export`.
  return await setSecret(account, secret);
}

export async function saveGitHubTokenAction(
  secret: string,
): Promise<SetSecretResult> {
  if (!secret.startsWith("ghp_") && !secret.startsWith("github_pat_")) {
    throw new Error(
      "Token doesn't look like a GitHub PAT (expected ghp_* or github_pat_*).",
    );
  }
  return await setSecret("github-token", secret);
}

export async function setRepoAction(repo: string): Promise<void> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error("Expected owner/name format.");
  }
  const cwd = getOhpenCwd();
  const current = await loadConfig(cwd);
  current.git.repo = repo;
  const validated = ConfigSchema.parse(current);
  await writeConfig(cwd, validated);
  revalidatePath("/setup");
}

export async function setAutonomyAction(
  autonomy: AutonomyMode,
): Promise<void> {
  const cwd = getOhpenCwd();
  const current = await loadConfig(cwd);
  current.agents.autonomy = autonomy;
  const validated = ConfigSchema.parse(current);
  await writeConfig(cwd, validated);
  revalidatePath("/setup");
}

export async function setRiskyAction(
  risky: Record<string, boolean>,
): Promise<void> {
  const cwd = getOhpenCwd();
  const current = await loadConfig(cwd);
  current.scans.risky = risky;
  const validated = ConfigSchema.parse(current);
  await writeConfig(cwd, validated);
  revalidatePath("/setup");
}

export async function setAuthorisationAckAction(
  acknowledged: boolean,
  actor?: string,
): Promise<void> {
  const cwd = getOhpenCwd();
  const current = await loadConfig(cwd);
  current.scope.authorisation_acknowledged = acknowledged;
  if (acknowledged) {
    current.scope.authorisation_acknowledged_at = new Date().toISOString();
    current.scope.authorisation_acknowledged_by = actor ?? null;
  } else {
    current.scope.authorisation_acknowledged_at = null;
    current.scope.authorisation_acknowledged_by = null;
  }
  const validated = ConfigSchema.parse(current);
  await writeConfig(cwd, validated);
  revalidatePath("/setup");
}
