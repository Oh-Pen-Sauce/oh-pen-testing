import type {
  CompletionUsage,
  RateLimitStrategy,
} from "@oh-pen-testing/shared";

export type HaltReason =
  | "ok"
  | "soft_cap"
  | "hard_cap"
  | "window_exhausted";

export interface ManagerState {
  strategy: RateLimitStrategy;
  budgetUsd: number;
  estimatedCostUsd: number;
  tokensIn: number;
  tokensOut: number;
  windowStartedAt: number;
  requestsInWindow: number;
  warnings: string[];
}

export interface RateLimitManager {
  readonly strategy: RateLimitStrategy;
  /** Call before each AI request. Returns "halt" to abort the scan. */
  beforeCall(): HaltReason;
  /** Call after each AI request to update accounting. */
  afterCall(usage: CompletionUsage | undefined): void;
  /** Percent used (0-100) for UI. */
  utilisationPct(): number;
  /** Snapshot for logging / UI. */
  snapshot(): Readonly<ManagerState>;
  /** Warnings not yet reported to the user. Mutating — returns + clears. */
  consumeWarnings(): string[];
}

export interface RateLimitManagerOptions {
  strategy: RateLimitStrategy;
  /** Budget for api-key providers. Ignored for others. */
  budgetUsd?: number;
  /**
   * Cost-per-million-tokens for rough budget accounting. Default approximates
   * Claude Opus input+output pricing. Users with different providers override.
   */
  costPerMillionInput?: number;
  costPerMillionOutput?: number;
  /** Clock injection for tests. */
  now?: () => number;
}

export const DEFAULT_COST_PER_MIL_INPUT = 15; // USD per million tokens (Opus input)
export const DEFAULT_COST_PER_MIL_OUTPUT = 75; // USD per million tokens (Opus output)

export function createRateLimitManager(
  options: RateLimitManagerOptions,
): RateLimitManager {
  const now = options.now ?? (() => Date.now());
  const state: ManagerState = {
    strategy: options.strategy,
    budgetUsd: options.budgetUsd ?? 5.0,
    estimatedCostUsd: 0,
    tokensIn: 0,
    tokensOut: 0,
    windowStartedAt: now(),
    requestsInWindow: 0,
    warnings: [],
  };
  const costIn = options.costPerMillionInput ?? DEFAULT_COST_PER_MIL_INPUT;
  const costOut = options.costPerMillionOutput ?? DEFAULT_COST_PER_MIL_OUTPUT;
  let softWarned = false;

  function pctUsed(): number {
    if (state.strategy.class === "api-key") {
      return state.budgetUsd > 0
        ? (state.estimatedCostUsd / state.budgetUsd) * 100
        : 0;
    }
    if (state.strategy.class === "session-window") {
      const elapsed = now() - state.windowStartedAt;
      const windowMs = (state.strategy.windowHours ?? 5) * 3600 * 1000;
      return Math.min(100, (elapsed / windowMs) * 100);
    }
    return 0;
  }

  return {
    strategy: options.strategy,

    beforeCall(): HaltReason {
      if (state.strategy.class === "local") return "ok";
      const pct = pctUsed();
      if (state.strategy.class === "api-key") {
        const soft = state.strategy.softCapPct ?? 50;
        const hard = state.strategy.hardCapPct ?? 100;
        if (pct >= hard) return "hard_cap";
        if (pct >= soft && !softWarned) {
          state.warnings.push(
            `Budget soft cap reached (${pct.toFixed(0)}% of $${state.budgetUsd}). Continuing.`,
          );
          softWarned = true;
        }
        return "ok";
      }
      if (state.strategy.class === "session-window") {
        const halt = state.strategy.haltAtPct ?? 90;
        if (pct >= halt) return "window_exhausted";
        return "ok";
      }
      return "ok";
    },

    afterCall(usage: CompletionUsage | undefined): void {
      if (!usage) return;
      state.tokensIn += usage.inputTokens ?? 0;
      state.tokensOut += usage.outputTokens ?? 0;
      state.requestsInWindow += 1;
      if (state.strategy.class === "api-key") {
        const inCost = ((usage.inputTokens ?? 0) / 1_000_000) * costIn;
        const outCost = ((usage.outputTokens ?? 0) / 1_000_000) * costOut;
        state.estimatedCostUsd += inCost + outCost;
      }
    },

    utilisationPct(): number {
      return pctUsed();
    },

    snapshot(): Readonly<ManagerState> {
      return { ...state };
    },

    consumeWarnings(): string[] {
      const out = [...state.warnings];
      state.warnings = [];
      return out;
    },
  };
}
