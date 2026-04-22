import { z } from "zod";
import type {
  AIProvider,
  CompletionMessage,
  SystemBlock,
} from "../provider/types.js";
import {
  AssistantReplySchema,
  type AssistantReply,
  type SetupAssistantBundle,
  type SetupState,
  type Skill,
  type Turn,
} from "./types.js";

/**
 * Provider-agnostic setup-assistant turn runner.
 *
 * The contract:
 *   1. We build a single deterministic system prompt from the bundle's
 *      memory + every skill's frontmatter + markdown body, plus a tail
 *      telling the model exactly what JSON shape to return.
 *   2. We serialise the conversation into alternating user/assistant
 *      messages (collapsing `system_note` turns into the tail of the
 *      most recent user message so the role sequence stays legal).
 *   3. We call `provider.complete()` and parse the text as JSON.
 *   4. We validate the reply against AssistantReplySchema, then do an
 *      extra validation pass on `action.input` using a Zod schema
 *      derived from the skill's `input_schema`. If either fails we
 *      return a safe fallback rather than throwing — the UI should
 *      keep the conversation alive even when the model misbehaves.
 *
 * No provider-specific logic lives here. Anything that implements
 * `AIProvider` works.
 */

export interface RunSetupTurnInput {
  provider: AIProvider;
  bundle: SetupAssistantBundle;
  conversation: Turn[];
  state: SetupState;
  /** Optional ambient observations (e.g. last probe result). */
  observations?: string[];
}

export interface RunSetupTurnResult {
  reply: AssistantReply;
  /** If the action validated against the skill's schema. */
  actionValid: boolean;
  /** Populated when actionValid is false. */
  actionError?: string;
  /** Raw model text — stashed for debug. */
  raw: string;
}

const SYSTEM_TAIL = `
---

## Output contract (strict)

On every turn you MUST reply with a single JSON object — no prose, no
markdown code fences, no trailing commentary. The shape is:

{
  "say": "Your reply to the user (1–2 sentences, Marinara voice).",
  "action": null | { "id": "<skill_id>", "input": { ... } }
}

- "say" is required on every turn.
- "action" is null unless you want to change state via a skill.
- If "action" is non-null, "id" MUST match one of the skill ids above
  and "input" MUST validate against that skill's input_schema.
- Never put secrets (API keys, PATs) in "say". Mask them.
- Never wrap the JSON in triple backticks.
`.trimStart();

function renderSkill(skill: Skill): string {
  return [
    `### Skill: ${skill.id} — ${skill.name}`,
    ``,
    `**When to use:** ${skill.whenToUse}`,
    ``,
    `**Input schema:**`,
    "```json",
    JSON.stringify(skill.inputSchema, null, 2),
    "```",
    ``,
    skill.body.trim(),
  ].join("\n");
}

function buildSystemPrompt(
  bundle: SetupAssistantBundle,
  state: SetupState,
  observations: string[] | undefined,
): SystemBlock[] {
  const skills = bundle.skills.map(renderSkill).join("\n\n---\n\n");
  const stateBlock = [
    "## Current setup state (snapshot)",
    "",
    "```json",
    JSON.stringify(state, null, 2),
    "```",
  ].join("\n");
  const observationsBlock = observations?.length
    ? [
        "## Recent runtime observations",
        "",
        ...observations.map((o) => `- ${o}`),
      ].join("\n")
    : "";
  return [
    { text: bundle.memory, cache: true },
    {
      text: [
        "# Skills you can invoke",
        "",
        "Each skill below is a tool you may call at most once per turn by emitting an `action` object whose `id` matches the skill's id and whose `input` validates against the skill's input_schema.",
        "",
        skills,
      ].join("\n"),
      cache: true,
    },
    {
      text: [stateBlock, observationsBlock, SYSTEM_TAIL]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

function conversationToMessages(turns: Turn[]): CompletionMessage[] {
  // Collapse consecutive same-role turns. system_note gets folded into the
  // next user turn as a leading "[system] ..." line so we never send a
  // bare system role to the provider.
  const out: CompletionMessage[] = [];
  let pendingNotes: string[] = [];
  for (const t of turns) {
    if (t.from === "system_note") {
      pendingNotes.push(t.text);
      continue;
    }
    const role = t.from === "user" ? "user" : "assistant";
    const content =
      role === "user" && pendingNotes.length > 0
        ? `[system] ${pendingNotes.join(" ")}\n\n${t.text}`
        : t.text;
    pendingNotes = role === "user" ? [] : pendingNotes;
    if (out.length > 0 && out[out.length - 1]!.role === role) {
      out[out.length - 1]!.content += `\n\n${content}`;
    } else {
      out.push({ role, content });
    }
  }
  // If we have leftover notes but no trailing user turn, prepend them as
  // a user turn so the provider has *something* to answer.
  if (pendingNotes.length > 0) {
    out.push({
      role: "user",
      content: `[system] ${pendingNotes.join(" ")}`,
    });
  }
  return out;
}

/**
 * Best-effort JSON extraction. Prefers the first balanced `{...}` block
 * in the text — handles cases where the model prepends stray prose even
 * though it was told not to.
 */
function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  // Strip markdown code fences if the model used them despite instructions.
  const fence = /```(?:json)?\s*([\s\S]*?)```/m.exec(trimmed);
  if (fence?.[1]) return fence[1].trim();
  // Scan for balanced braces.
  let depth = 0;
  let start = -1;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        return trimmed.slice(start, i + 1);
      }
    }
  }
  return null;
}

/**
 * Derive a lightweight Zod schema from a skill's JSON-Schema-ish input
 * spec. Handles `type: object` with simple property types (string /
 * number / boolean / enum / pattern). Good enough for the narrow
 * input shapes we ship.
 */
function zodSchemaFromInputSchema(
  schema: Skill["inputSchema"],
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  const req = new Set(schema.required ?? []);
  for (const [key, rawSpec] of Object.entries(schema.properties ?? {})) {
    const spec = (rawSpec ?? {}) as {
      type?: string;
      enum?: unknown[];
      pattern?: string;
      minLength?: number;
      maxLength?: number;
    };
    let leaf: z.ZodTypeAny;
    if (Array.isArray(spec.enum)) {
      leaf = z.enum(spec.enum as [string, ...string[]]);
    } else {
      switch (spec.type) {
        case "string": {
          let s = z.string();
          if (spec.pattern) s = s.regex(new RegExp(spec.pattern));
          if (typeof spec.minLength === "number")
            s = s.min(spec.minLength);
          if (typeof spec.maxLength === "number")
            s = s.max(spec.maxLength);
          leaf = s;
          break;
        }
        case "number":
          leaf = z.number();
          break;
        case "boolean":
          leaf = z.boolean();
          break;
        default:
          leaf = z.unknown();
      }
    }
    shape[key] = req.has(key) ? leaf : leaf.optional();
  }
  return z.object(shape);
}

export async function runSetupAssistantTurn(
  input: RunSetupTurnInput,
): Promise<RunSetupTurnResult> {
  const { provider, bundle, conversation, state, observations } = input;
  const system = buildSystemPrompt(bundle, state, observations);
  const messages = conversationToMessages(conversation);

  const result = await provider.complete({
    system,
    messages,
    // Teacher-mode walkthroughs (multi-step PAT / install guides) can
    // run long — give the model enough headroom to emit a complete
    // numbered list + trailing question without getting clipped.
    maxTokens: 1500,
    temperature: 0.4,
  });

  const raw = result.text;
  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    return {
      reply: {
        say: "Sorry — I got confused for a second. Mind saying that again?",
        action: null,
      },
      actionValid: false,
      actionError: "Model returned no JSON object",
      raw,
    };
  }

  let parsedUnknown: unknown;
  try {
    parsedUnknown = JSON.parse(jsonText);
  } catch (err) {
    return {
      reply: {
        say: "Sorry — I got confused for a second. Mind saying that again?",
        action: null,
      },
      actionValid: false,
      actionError: `JSON parse failed: ${(err as Error).message}`,
      raw,
    };
  }

  const replyParse = AssistantReplySchema.safeParse(parsedUnknown);
  if (!replyParse.success) {
    return {
      reply: {
        say: "Sorry — I got confused for a second. Mind saying that again?",
        action: null,
      },
      actionValid: false,
      actionError: `Reply shape invalid: ${replyParse.error.message}`,
      raw,
    };
  }

  const reply = replyParse.data;
  if (!reply.action) {
    return { reply, actionValid: true, raw };
  }

  const skill = bundle.skills.find((s) => s.id === reply.action!.id);
  if (!skill) {
    return {
      reply: { say: reply.say, action: null },
      actionValid: false,
      actionError: `Unknown skill id: ${reply.action.id}`,
      raw,
    };
  }
  const inputParse = zodSchemaFromInputSchema(skill.inputSchema).safeParse(
    reply.action.input,
  );
  if (!inputParse.success) {
    return {
      reply: { say: reply.say, action: null },
      actionValid: false,
      actionError: `Action input invalid: ${inputParse.error.message}`,
      raw,
    };
  }
  return {
    reply: {
      say: reply.say,
      action: { id: reply.action.id, input: inputParse.data },
    },
    actionValid: true,
    raw,
  };
}
