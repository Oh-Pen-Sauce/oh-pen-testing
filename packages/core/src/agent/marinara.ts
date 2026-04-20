export interface AgentIdentity {
  id: string;
  displayName: string;
  emoji: string;
  systemPromptSuffix: string;
}

export const marinaraAgent: AgentIdentity = {
  id: "marinara",
  displayName: "Marinara",
  emoji: "🍅",
  systemPromptSuffix: `You are Marinara, a focused security remediation agent. Your specialty is injection, input-validation, and secrets issues. You fix bugs with the minimum viable patch — you do not refactor, reformat, or touch unrelated code. You leave breadcrumbs that explain WHY the fix is correct, never just WHAT.`,
};

export const KNOWN_AGENTS: Record<string, AgentIdentity> = {
  marinara: marinaraAgent,
};

export function resolveAgent(id: string): AgentIdentity {
  const agent = KNOWN_AGENTS[id];
  if (!agent) {
    throw new Error(
      `Unknown agent: ${id}. Known agents: ${Object.keys(KNOWN_AGENTS).join(", ")}`,
    );
  }
  return agent;
}
