import { describe, expect, it } from "vitest";
import { createRateLimitManager } from "./manager.js";

describe("RateLimitManager", () => {
  describe("api-key strategy", () => {
    it("warns on soft cap and halts on hard cap", () => {
      const mgr = createRateLimitManager({
        strategy: { class: "api-key", softCapPct: 50, hardCapPct: 100 },
        budgetUsd: 1.0,
        costPerMillionInput: 1.0, // $1 per million tokens
        costPerMillionOutput: 1.0,
      });
      expect(mgr.beforeCall()).toBe("ok");
      mgr.afterCall({ inputTokens: 300_000, outputTokens: 300_000 }); // $0.60 spent
      expect(mgr.beforeCall()).toBe("ok"); // 60% > 50% soft
      const warnings = mgr.consumeWarnings();
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toMatch(/soft cap/i);
      mgr.afterCall({ inputTokens: 500_000, outputTokens: 0 }); // +$0.50 → $1.10
      expect(mgr.beforeCall()).toBe("hard_cap");
    });

    it("stays at ok below soft cap", () => {
      const mgr = createRateLimitManager({
        strategy: { class: "api-key", softCapPct: 50, hardCapPct: 100 },
        budgetUsd: 10.0,
      });
      mgr.afterCall({ inputTokens: 1000, outputTokens: 1000 });
      expect(mgr.beforeCall()).toBe("ok");
      expect(mgr.consumeWarnings()).toEqual([]);
    });
  });

  describe("session-window strategy", () => {
    it("halts at halt-at pct", () => {
      let now = 0;
      const mgr = createRateLimitManager({
        strategy: { class: "session-window", windowHours: 5, haltAtPct: 90 },
        now: () => now,
      });
      expect(mgr.beforeCall()).toBe("ok");
      now += 4.6 * 3600 * 1000; // 92% of a 5-hour window
      expect(mgr.beforeCall()).toBe("window_exhausted");
    });
  });

  describe("local strategy", () => {
    it("never halts", () => {
      const mgr = createRateLimitManager({
        strategy: { class: "local" },
      });
      for (let i = 0; i < 100; i++) {
        expect(mgr.beforeCall()).toBe("ok");
        mgr.afterCall({ inputTokens: 1000, outputTokens: 1000 });
      }
    });
  });
});
