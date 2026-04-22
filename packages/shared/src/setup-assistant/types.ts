import { z } from "zod";

/**
 * Types shared between the setup-assistant loader and the turn runner.
 *
 * These describe the *bundle* any AI needs to run onboarding: a system
 * memory blob + a list of skills. The format is intentionally generic so
 * the same bundle can be loaded by our web UI, a future CLI-driven chat,
 * or a third-party harness.
 */

/** YAML frontmatter shape for a skill file. */
export const SkillFrontmatterSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(1),
  when_to_use: z.string().min(1),
  /**
   * A JSON-Schema-ish object describing the action's input. The loader
   * does not enforce full JSON Schema — it just passes the object through
   * for the AI to honour and (separately) uses a derived Zod schema
   * during action dispatch.
   */
  input_schema: z.object({
    type: z.literal("object"),
    additionalProperties: z.boolean().optional(),
    properties: z.record(z.string(), z.unknown()).default({}),
    required: z.array(z.string()).optional(),
  }),
});
export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

export interface Skill {
  id: string;
  name: string;
  whenToUse: string;
  inputSchema: SkillFrontmatter["input_schema"];
  /** The full markdown body (everything after the frontmatter). */
  body: string;
}

export interface SetupAssistantBundle {
  /** The memory.md system prompt. */
  memory: string;
  /** Skill definitions, in stable order. */
  skills: Skill[];
}

/** The JSON shape we ask the AI to emit on every turn. */
export const AssistantReplySchema = z.object({
  say: z.string().min(1),
  action: z
    .object({
      id: z.string(),
      input: z.record(z.string(), z.unknown()).default({}),
    })
    .nullable()
    .default(null),
});
export type AssistantReply = z.infer<typeof AssistantReplySchema>;

/** Conversation turns sent to the assistant. */
export const TurnSchema = z.object({
  from: z.enum(["user", "assistant", "system_note"]),
  text: z.string(),
});
export type Turn = z.infer<typeof TurnSchema>;

/**
 * Snapshot of setup state sent to the assistant each turn so it knows
 * what's already persisted and doesn't re-ask. Kept intentionally small —
 * secrets never travel through here.
 */
export const SetupStateSchema = z.object({
  currentStep: z.enum([
    "provider",
    "credentials",
    "github",
    "autonomy",
    "authorisation",
    "done",
  ]),
  providerId: z.string().nullable(),
  providerProbeOk: z.boolean().nullable(),
  repoSet: z.boolean(),
  tokenSaved: z.boolean(),
  autonomy: z
    .enum(["full-yolo", "yolo", "recommended", "careful"])
    .nullable(),
  authAcknowledged: z.boolean(),
});
export type SetupState = z.infer<typeof SetupStateSchema>;
