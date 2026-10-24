import { describe, expect, it } from "vitest";
import { evaluateRule } from "../src/lib/rule-engine";
import type { EvalContext, MonitorRule } from "../src/lib/types";

const priceRule: MonitorRule = {
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

describe("rule-engine extra anomaly paths", () => {
  it("does not trigger when quote is missing", () => {
    const ctx: EvalContext = {
      now: new Date(),
      dataFault: null,
      events: [],
      calendar: [],
      quotes: {},
    };
    const result = evaluateRule("missing", priceRule, ctx);
    // 无标的且无 fault 时，collectSymbols 全部缺失 → staleAll 为 true → 降级
    expect(result.triggered).toBe(false);
    expect(result.degraded || result.explanation.includes("缺少") || result.explanation.includes("过期")).toBe(
      true,
    );
  });

  it("degrades on conflict without emitting trigger", () => {
    const ctx: EvalContext = {
      now: new Date(),
      dataFault: "conflict",
      events: [],
      calendar: [],
      quotes: {
        "600519": {
          symbol: "600519",
          name: "贵州茅台",
          price: 1650,
          prevClose: 1720,
          changePct: -4,
          heat: 70,
          volume: 1,
          asOf: new Date().toISOString(),
          source: "SIMULATED",
          freshnessSec: 60,
        },
      },
    };
    const result = evaluateRule("conflict", priceRule, ctx);
    expect(result.degraded).toBe(true);
    expect(result.triggered).toBe(false);
    expect(result.degradeReason).toContain("冲突");
  });

  it("keeps stable fingerprint for same observed bucket (dedup basis)", () => {
    const ctx: EvalContext = {
      now: new Date(),
      dataFault: null,
      events: [],
      calendar: [],
      quotes: {
        "600519": {
          symbol: "600519",
          name: "贵州茅台",
          price: 1650.04,
          prevClose: 1720,
          changePct: -4,
          heat: 70,
          volume: 1,
          asOf: new Date().toISOString(),
          source: "SIMULATED",
          freshnessSec: 60,
        },
      },
    };
    const a = evaluateRule("fp", priceRule, ctx);
    const b = evaluateRule("fp", priceRule, ctx);
    expect(a.triggered).toBe(true);
    expect(a.fingerprint).toBe(b.fingerprint);
  });
});
