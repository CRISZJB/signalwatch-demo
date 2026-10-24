import { describe, expect, it } from "vitest";
import { evaluateRule } from "../src/lib/rule-engine";
import type { EvalContext, MonitorRule } from "../src/lib/types";

const priceRule: MonitorRule = {
  severity: "warning",
  condition: {
    type: "price",
    symbol: "600519",
    comparator: "cross_below",
    threshold: 1700,
  },
};

const eventRule: MonitorRule = {
  severity: "warning",
  condition: { type: "event", symbol: "600519", keywords: ["减持"] },
};

describe("A-05 malformed market data", () => {
  it("rejects NaN price without triggering", () => {
    const ctx: EvalContext = {
      now: new Date(),
      dataFault: null,
      events: [],
      calendar: [],
      quotes: {
        "600519": {
          symbol: "600519",
          name: "贵州茅台",
          price: Number.NaN,
          prevClose: 1720,
          changePct: -1,
          heat: 70,
          volume: 1,
          asOf: new Date().toISOString(),
          source: "SIMULATED",
          freshnessSec: 60,
        },
      },
    };
    const r = evaluateRule("a05-nan", priceRule, ctx);
    expect(r.triggered).toBe(false);
    expect(r.degraded).toBe(true);
    expect(r.degradeReason).toContain("格式异常");
    expect(r.explanation).toMatch(/非法|格式异常/);
  });

  it("rejects string-like price injected via cast", () => {
    const ctx: EvalContext = {
      now: new Date(),
      dataFault: null,
      events: [],
      calendar: [],
      quotes: {
        "600519": {
          symbol: "600519",
          name: "贵州茅台",
          // 故意注入错误类型
          price: "not-a-number" as unknown as number,
          prevClose: 1720,
          changePct: -1,
          heat: 70,
          volume: 1,
          asOf: new Date().toISOString(),
          source: "SIMULATED",
          freshnessSec: 60,
        },
      },
    };
    const r = evaluateRule("a05-str", priceRule, ctx);
    expect(r.triggered).toBe(false);
    expect(r.degraded).toBe(true);
  });

  it("rejects missing asOf", () => {
    const ctx: EvalContext = {
      now: new Date(),
      dataFault: null,
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
          asOf: "",
          source: "SIMULATED",
          freshnessSec: 60,
        },
      },
    };
    const r = evaluateRule("a05-asof", priceRule, ctx);
    expect(r.triggered).toBe(false);
    expect(r.degraded).toBe(true);
  });
});

describe("A-06 duplicate events", () => {
  const dupEvent = {
    id: "evt-dup-1",
    symbol: "600519",
    title: "股东减持公告",
    keywords: ["减持"],
    publishedAt: "2026-10-24",
    source: "SIMULATED" as const,
  };

  it("collapses duplicate event ids in observation", () => {
    const ctx: EvalContext = {
      now: new Date(),
      dataFault: null,
      events: [dupEvent, { ...dupEvent }, { ...dupEvent }],
      calendar: [],
      quotes: {},
    };
    const r = evaluateRule("a06", eventRule, ctx);
    expect(r.triggered).toBe(true);
    expect(r.observed.hits).toEqual(["evt-dup-1"]);
    expect(r.observed.duplicateCollapsed).toBe(2);
    expect(r.observed.rawHitCount).toBe(3);
    expect(r.observed.hitCount).toBe(1);
  });

  it("same fingerprint when duplicates present or once", () => {
    const once: EvalContext = {
      now: new Date(),
      dataFault: null,
      events: [dupEvent],
      calendar: [],
      quotes: {},
    };
    const many: EvalContext = {
      ...once,
      events: [dupEvent, dupEvent, dupEvent],
    };
    const a = evaluateRule("a06-fp", eventRule, once);
    const b = evaluateRule("a06-fp", eventRule, many);
    expect(a.fingerprint).toBe(b.fingerprint);
  });
});
