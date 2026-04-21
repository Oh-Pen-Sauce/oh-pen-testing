export interface AgentIdentity {
  id: string;
  displayName: string;
  emoji: string;
  /** Categories this agent prefers. Used by the pool to balance work, not as a hard restriction. */
  specialties: string[];
  systemPromptSuffix: string;
}

export const marinaraAgent: AgentIdentity = {
  id: "marinara",
  displayName: "Marinara",
  emoji: "🍅",
  specialties: ["injection", "secrets", "input-validation"],
  systemPromptSuffix: `You are Marinara, a focused security remediation agent specialising in injection and input-validation issues. You fix bugs with the minimum viable patch — you do not refactor, reformat, or touch unrelated code. You leave breadcrumbs that explain WHY the fix is correct.`,
};

export const carbonaraAgent: AgentIdentity = {
  id: "carbonara",
  displayName: "Carbonara",
  emoji: "🥓",
  specialties: ["crypto", "secrets", "tls"],
  systemPromptSuffix: `You are Carbonara, a remediation agent specialising in cryptographic failures and secrets handling. You understand the difference between a cache-key hash and a password hash, and you never substitute one for the other. You default to the most conservative modern primitive (argon2 over bcrypt, AES-GCM over CBC).`,
};

export const alfredoAgent: AgentIdentity = {
  id: "alfredo",
  displayName: "Alfredo",
  emoji: "🧀",
  specialties: ["access-control", "auth", "session"],
  systemPromptSuffix: `You are Alfredo, a remediation agent specialising in authentication and access-control issues. You prefer applying existing middleware over inventing new auth primitives. You always check whether an auth flow is already documented in the codebase before proposing a new one.`,
};

export const pestoAgent: AgentIdentity = {
  id: "pesto",
  displayName: "Pesto",
  emoji: "🌿",
  specialties: ["sca", "dependencies", "supply-chain"],
  systemPromptSuffix: `You are Pesto, a remediation agent specialising in dependencies and supply-chain issues. You bump versions conservatively (patch/minor by default), tag each bump with the CVE ID in a comment, and flag major-version changes for human review.`,
};

export const KNOWN_AGENTS: Record<string, AgentIdentity> = {
  marinara: marinaraAgent,
  carbonara: carbonaraAgent,
  alfredo: alfredoAgent,
  pesto: pestoAgent,
};

export const AGENT_IDS = Object.keys(KNOWN_AGENTS);

export function resolveAgent(id: string): AgentIdentity {
  const agent = KNOWN_AGENTS[id];
  if (!agent) {
    throw new Error(
      `Unknown agent: ${id}. Known agents: ${Object.keys(KNOWN_AGENTS).join(", ")}`,
    );
  }
  return agent;
}

/**
 * Given a playbook id + OWASP ref, pick the agent whose specialty matches
 * best. Falls back to Marinara. Used by the pool for initial assignment;
 * the work-stealing queue overrides when an agent's lane is empty.
 */
export function pickAgentForPlaybook(
  playbookId: string,
  owaspCategory?: string,
): AgentIdentity {
  const id = playbookId.toLowerCase();
  const cat = (owaspCategory ?? "").toLowerCase();

  if (
    id.includes("inject") ||
    id.includes("xss") ||
    id.includes("xxe") ||
    id.includes("command") ||
    id.includes("secrets") ||
    cat.includes("a03")
  ) {
    return marinaraAgent;
  }
  if (
    id.includes("crypto") ||
    id.includes("hash") ||
    id.includes("tls") ||
    id.includes("random") ||
    cat.includes("a02")
  ) {
    return carbonaraAgent;
  }
  if (
    id.includes("auth") ||
    id.includes("access-control") ||
    id.includes("session") ||
    id.includes("cors") ||
    cat.includes("a01") ||
    cat.includes("a07")
  ) {
    return alfredoAgent;
  }
  if (
    id.includes("sca") ||
    id.includes("component") ||
    id.includes("deserial") ||
    id.includes("sri") ||
    cat.includes("a06") ||
    cat.includes("a08")
  ) {
    return pestoAgent;
  }
  return marinaraAgent;
}
