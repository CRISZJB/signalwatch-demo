import { describe, expect, it } from "vitest";
import { parseNaturalLanguage } from "../src/lib/nl-parser";
import { evaluateRule } from "../src/lib/rule-engine";
import type { EvalContext, MonitorRule } from "../src/lib/types";

/**
 * 端到端逻辑链路（不依赖 HTTP）：自然语言 → 规则 → 引擎判定
 */
describe("e2e logical flow", () => {
  it("NL to trigger explanation", () => {
    const parsed = parseNaturalLanguage("贵州茅台跌破1700元提醒我");
    expect(parsed.success).toBe(true);
    const rule = parsed.rule as MonitorRule;

    const ctx: EvalContext = {
      now: new Date(),
      dataFault: null,
      events: [],
      calendar: [],
      quotes: {
        "600519": {
          symbol: "600519",
          name: "贵州茅台",
          price: 1680,
          prevClose: 1710,
          changePct: -1.75,
          heat: 70,
          volume: 100,
          asOf: new Date().toISOString(),
          source: "SIMULATED",
          freshnessSec: 60,
        },
      },
    };

    const hit = evaluateRule("demo", rule, ctx);
    expect(hit.triggered).toBe(true);
    expect(hit.fingerprint).toBeTruthy();

    const missCtx = {
      ...ctx,
      quotes: {
        "600519": { ...ctx.quotes["600519"], price: 1750, prevClose: 1710, changePct: 2.3 },
      },
    };
    const miss = evaluateRule("demo", rule, missCtx);
    expect(miss.triggered).toBe(false);
    expect(miss.explanation).toContain("未满足");
  });
});
