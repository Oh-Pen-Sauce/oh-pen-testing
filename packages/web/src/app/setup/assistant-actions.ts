"use server";

import { spawn } from "node:child_process";
import {
  loadConfig,
  loadSetupAssistantBundle,
  runSetupAssistantTurn,
  type AutonomyMode,
  type ProviderId,
  type SetupState,
  type Turn,
} from "@oh-pen-testing/shared";
import { resolveProvider } from "@oh-pen-testing/core";
import { getOhpenCwd } from "../../lib/ohpen-cwd";
import { ensureProvidersRegistered } from "../../lib/providers-bootstrap";
import {
  probeProviderAction,
  saveApiKeyAction,
  saveGitHubTokenAction,
  setAutonomyAction,
  setAuthorisationAckAction,
  setProviderAction,
  setRepoAction,
} from "./actions";

/**
 * Server-side bridge between the chat UI and the setup-assistant bundle.
 *
 * - assistantTurnAction: loads the bundle, resolves the configured
 *   provider, calls runSetupAssistantTurn with the conversation + state.
 * - executeAssistantActionAction: dispatches a validated skill action
 *   to the underlying server action (setProvider / saveApiKey / etc.).
 * - detectRepoAction: helper skill the AI can call via executeAction.
 */

export async function assistantTurnAction(args: {
  conversation: Turn[];
  state: SetupState;
  observations?: string[];
}): Promise<{
  say: string;
  action: { id: string; input: Record<string, unknown> } | null;
  actionValid: boolean;
  actionError?: string;
}> {
  ensureProvidersRegistered();
  const cwd = getOhpenCwd();
  const config = await loadConfig(cwd);
  const provider = await resolveProvider({ config });
  const bundle = loadSetupAssistantBundle();

  const result = await runSetupAssistantTurn({
    provider,
    bundle,
    conversation: args.conversation,
    state: args.state,
    observations: args.observations,
  });

  return {
    say: result.reply.say,
    action: result.reply.action,
    actionValid: result.actionValid,
    actionError: result.actionError,
  };
}

export interface ExecuteActionOutcome {
  ok: boolean;
  detail?: string;
  /** Updated state keys the UI should merge. */
  stateDelta?: Partial<SetupState>;
}

export async function executeAssistantActionAction(
  actionId: string,
  input: Record<string, unknown>,
): Promise<ExecuteActionOutcome> {
  try {
    switch (actionId) {
      case "probe_provider": {
        const id = input.provider_id as ProviderId;
        const res = await probeProviderAction(id);
        return {
          ok: res.ok,
          detail: res.detail,
          stateDelta: { providerProbeOk: res.ok },
        };
      }
      case "set_provider": {
        const id = input.provider_id as ProviderId;
        const model = typeof input.model === "string" ? input.model : undefined;
        await setProviderAction(id, model);
        return {
          ok: true,
          detail: `Set to ${id}`,
          stateDelta: { providerId: id, providerProbeOk: null },
        };
      }
      case "save_api_key": {
        const id = input.provider_id as ProviderId;
        const secret = input.secret as string;
        const res = await saveApiKeyAction(id, secret);
        return { ok: true, detail: res.detail };
      }
      case "detect_repo": {
        const res = await detectRepoFromGit();
        return { ok: res.ok, detail: res.detail };
      }
      case "set_repo": {
        const repo = input.repo as string;
        await setRepoAction(repo);
        return {
          ok: true,
          detail: `Repo set to ${repo}`,
          stateDelta: { repoSet: true },
        };
      }
      case "save_github_token": {
        const secret = input.secret as string;
        const res = await saveGitHubTokenAction(secret);
        return {
          ok: true,
          detail: res.detail,
          stateDelta: { tokenSaved: true },
        };
      }
      case "set_autonomy": {
        const mode = input.mode as AutonomyMode;
        await setAutonomyAction(mode);
        return {
          ok: true,
          detail: `Autonomy set to ${mode}`,
          stateDelta: { autonomy: mode },
        };
      }
      case "acknowledge_authorisation": {
        const actor = input.actor_name as string;
        await setAuthorisationAckAction(true, actor);
        return {
          ok: true,
          detail: `Acknowledged by ${actor}`,
          stateDelta: { authAcknowledged: true, currentStep: "done" },
        };
      }
      case "troubleshoot_claude_cli":
        // Pure informational skill — nothing to execute.
        return { ok: true, detail: "Reference material only" };
      default:
        return { ok: false, detail: `Unknown action: ${actionId}` };
    }
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

async function detectRepoFromGit(): Promise<{
  ok: boolean;
  detail: string;
  repo?: string;
}> {
  const cwd = getOhpenCwd();
  return new Promise((resolve) => {
    const child = spawn("git", ["remote", "get-url", "origin"], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", () =>
      resolve({ ok: false, detail: "git binary not found" }),
    );
    child.on("close", (code) => {
      if (code !== 0 || !stdout.trim()) {
        const reason =
          /not a git repository/i.test(stderr) === true
            ? "not a git repo"
            : stderr.trim()
              ? stderr.trim().split("\n")[0]!
              : "no origin remote";
        resolve({ ok: false, detail: reason });
        return;
      }
      const url = stdout.trim();
      const parsed = parseGitRemote(url);
      if (!parsed) {
        resolve({
          ok: false,
          detail: `Could not parse remote URL: ${url}`,
        });
      } else if (parsed.host !== "github.com") {
        resolve({
          ok: false,
          detail: `Non-GitHub remote (${parsed.host})`,
        });
      } else {
        resolve({
          ok: true,
          detail: `Detected ${parsed.repo}`,
          repo: parsed.repo,
        });
      }
    });
  });
}

function parseGitRemote(
  url: string,
): { host: string; repo: string } | null {
  // https://github.com/owner/name(.git)?
  const https = /^https:\/\/([^/]+)\/([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(
    url,
  );
  if (https) return { host: https[1]!, repo: https[2]! };
  // git@github.com:owner/name(.git)?
  const ssh = /^git@([^:]+):([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(url);
  if (ssh) return { host: ssh[1]!, repo: ssh[2]! };
  // ssh://git@host/owner/name(.git)?
  const sshUrl =
    /^ssh:\/\/git@([^/]+)\/([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(url);
  if (sshUrl) return { host: sshUrl[1]!, repo: sshUrl[2]! };
  return null;
}
