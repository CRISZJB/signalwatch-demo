import { describe, expect, it } from "vitest";
import { evaluateRule } from "../src/lib/rule-engine";
import type { EvalContext, MonitorRule } from "../src/lib/types";

const baseRule: MonitorRule = {
  symbol: "600519",
  symbolName: "贵州茅台",
  severity: "warning",
  condition: {
    type: "price",
    symbol: "600519",
    symbolName: "贵州茅台",
    comparator: "cross_below",
    threshold: 1700,
  },
};

function ctx(price: number, prevClose = 1720, fault: EvalContext["dataFault"] = null): EvalContext {
  return {
    now: new Date(),
    dataFault: fault,
    events: [],
    calendar: [],
    quotes: {
      "600519": {
        symbol: "600519",
        name: "贵州茅台",
        price,
        prevClose,
        changePct: ((price - prevClose) / prevClose) * 100,
        heat: 70,
        volume: 1,
        asOf: new Date().toISOString(),
        source: "SIMULATED",
        freshnessSec: 60,
        stale: fault === "stale",
      },
    },
  };
}

describe("rule-engine", () => {
  it("triggers when price crosses below threshold", () => {
    const result = evaluateRule("t1", baseRule, ctx(1690, 1720));
    expect(result.triggered).toBe(true);
    expect(result.explanation).toContain("满足");
  });

  it("does not trigger when price stays above", () => {
    const result = evaluateRule("t1", baseRule, ctx(1750, 1720));
    expect(result.triggered).toBe(false);
    expect(result.explanation).toContain("未满足");
  });

  it("degrades on timeout", () => {
    const result = evaluateRule("t1", baseRule, ctx(1690, 1720, "timeout"));
    expect(result.degraded).toBe(true);
    expect(result.triggered).toBe(false);
  });

  it("degrades on stale data", () => {
    const result = evaluateRule("t1", baseRule, ctx(1690, 1720, "stale"));
    expect(result.degraded).toBe(true);
  });
});
