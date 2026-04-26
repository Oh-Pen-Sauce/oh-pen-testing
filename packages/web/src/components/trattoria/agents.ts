// Pasta agent roster — presentational metadata, mirrors packages/core's agents.
// Single source of truth for the avatar colour + emoji + tagline used across
// the sidebar, playbook grid, reviews, and board cards.

export interface AgentMeta {
  id: "marinara" | "carbonara" | "alfredo" | "pesto" | "nonna";
  name: string;
  emoji: string;
  tag: string;
  color: string; // hex, used as the tinted avatar bg
  /**
   * Reviewer agents don't get pool buckets — they participate as
   * hooks inside runAgent. Used by the UI to render them in a
   * separate "head chef" group on /agents and on the sidebar
   * roster, so users understand why Nonna isn't picking up issues
   * the way the other four do.
   */
  role?: "worker" | "reviewer";
}

export const AGENTS: AgentMeta[] = [
  {
    id: "marinara",
    name: "Marinara",
    emoji: "🍅",
    tag: "injection · secrets · input",
    color: "#C8321E",
    role: "worker",
  },
  {
    id: "carbonara",
    name: "Carbonara",
    emoji: "🥓",
    tag: "crypto · secrets · tls",
    color: "#C8921E",
    role: "worker",
  },
  {
    id: "alfredo",
    name: "Alfredo",
    emoji: "🧀",
    tag: "access-control · auth · session",
    color: "#E9C46A",
    role: "worker",
  },
  {
    id: "pesto",
    name: "Pesto",
    emoji: "🌿",
    tag: "sca · deps · supply-chain",
    color: "#3F7A3A",
    role: "worker",
  },
  {
    id: "nonna",
    name: "Nonna",
    emoji: "👵",
    tag: "head chef · patch review",
    // Aubergine — distinct from the four worker palettes so she
    // visually reads as "different role" not "fifth worker".
    color: "#6B3F7A",
    role: "reviewer",
  },
];

export function agentById(id: string | undefined): AgentMeta | undefined {
  if (!id) return undefined;
  return AGENTS.find((a) => a.id === id.toLowerCase());
}

/**
 * Severity palette used on badges, cards, and strip tiles.
 */
export const SEVERITY_STYLE: Record<
  "critical" | "high" | "medium" | "low" | "info",
  { bg: string; fg: string; border: string }
> = {
  critical: { bg: "#FBE4E0", fg: "#8F1E10", border: "#C8321E" },
  high: { bg: "#FBEBDD", fg: "#9A5B06", border: "#E07A2B" },
  medium: { bg: "#FBF4D9", fg: "#8C6A05", border: "#D4A017" },
  low: { bg: "#E4F0DF", fg: "#2B5A27", border: "#3F7A3A" },
  info: { bg: "#DEE4F5", fg: "#1E3A8A", border: "#1E3A8A" },
};
