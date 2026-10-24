import { describe, expect, it } from "vitest";
import { evaluateRule } from "../src/lib/rule-engine";
import type { EvalContext, MonitorRule } from "../src/lib/types";

const baseQuote = {
  symbol: "600519",
  name: "贵州茅台",
  price: 1688,
  prevClose: 1700,
  changePct: -0.7,
  heat: 75,
  volume: 1,
  asOf: new Date().toISOString(),
  source: "SIMULATED" as const,
  freshnessSec: 60,
};

function ctx(partial: Partial<EvalContext> = {}): EvalContext {
  return {
    now: new Date(),
    dataFault: null,
    events: [],
    calendar: [],
    quotes: { "600519": { ...baseQuote } },
    ...partial,
  };
}

describe("price condition", () => {
  const rule: MonitorRule = {
    severity: "warning",
    condition: {
      type: "price",
      symbol: "600519",
      comparator: "lt",
      threshold: 1700,
    },
  };
  it("matches when price below threshold", () => {
    expect(evaluateRule("p1", rule, ctx({ quotes: { "600519": { ...baseQuote, price: 1650 } } })).triggered).toBe(
      true,
    );
  });
  it("does not match when price above", () => {
    expect(evaluateRule("p2", rule, ctx({ quotes: { "600519": { ...baseQuote, price: 1800 } } })).triggered).toBe(
      false,
    );
  });
  it("cannot judge when quote missing → degraded", () => {
    const r = evaluateRule("p3", rule, ctx({ quotes: {} }));
    expect(r.triggered).toBe(false);
    expect(r.degraded).toBe(true);
  });
});

describe("change_pct condition", () => {
  const rule: MonitorRule = {
    severity: "warning",
    condition: { type: "change_pct", symbol: "600519", comparator: "lte", threshold: -3 },
  };
  it("matches", () => {
    expect(
      evaluateRule("c1", rule, ctx({ quotes: { "600519": { ...baseQuote, changePct: -5 } } })).triggered,
    ).toBe(true);
  });
  it("does not match", () => {
    expect(
      evaluateRule("c2", rule, ctx({ quotes: { "600519": { ...baseQuote, changePct: -1 } } })).triggered,
    ).toBe(false);
  });
});

describe("heat condition", () => {
  const rule: MonitorRule = {
    severity: "info",
    condition: { type: "heat", symbol: "600519", comparator: "gt", threshold: 80 },
  };
  it("matches", () => {
    expect(evaluateRule("h1", rule, ctx({ quotes: { "600519": { ...baseQuote, heat: 90 } } })).triggered).toBe(
      true,
    );
  });
  it("does not match", () => {
    expect(evaluateRule("h2", rule, ctx({ quotes: { "600519": { ...baseQuote, heat: 70 } } })).triggered).toBe(
      false,
    );
  });
});

describe("event condition", () => {
  const rule: MonitorRule = {
    severity: "warning",
    condition: { type: "event", symbol: "600519", keywords: ["减持"] },
  };
  it("matches", () => {
    const r = evaluateRule(
      "e1",
      rule,
      ctx({
        events: [
          {
            id: "evt-1",
            symbol: "600519",
            title: "股东减持公告",
            keywords: ["减持"],
            publishedAt: "2026-10-24",
            source: "SIMULATED",
          },
        ],
      }),
    );
    expect(r.triggered).toBe(true);
  });
  it("does not match", () => {
    const r = evaluateRule(
      "e2",
      rule,
      ctx({
        events: [
          {
            id: "evt-2",
            symbol: "600519",
            title: "日常经营公告",
            keywords: ["公告"],
            publishedAt: "2026-10-24",
            source: "SIMULATED",
          },
        ],
      }),
    );
    expect(r.triggered).toBe(false);
  });
});

describe("calendar condition", () => {
  const rule: MonitorRule = {
    severity: "info",
    condition: { type: "calendar", symbol: "600519", eventType: "earnings", withinDays: 7 },
  };
  it("matches within window", () => {
    const in3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const r = evaluateRule(
      "cal1",
      rule,
      ctx({
        calendar: [
          {
            id: "cal-1",
            symbol: "600519",
            eventType: "earnings",
            title: "财报",
            date: in3,
            source: "SIMULATED",
          },
        ],
      }),
    );
    expect(r.triggered).toBe(true);
  });
  it("does not match outside window", () => {
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const r = evaluateRule(
      "cal2",
      rule,
      ctx({
        calendar: [
          {
            id: "cal-2",
            symbol: "600519",
            eventType: "earnings",
            title: "财报",
            date: in30,
            source: "SIMULATED",
          },
        ],
      }),
    );
    expect(r.triggered).toBe(false);
  });
});

describe("composite AND / OR", () => {
  const andRule: MonitorRule = {
    severity: "warning",
    condition: {
      type: "composite",
      logic: "AND",
      children: [
        { type: "price", symbol: "600519", comparator: "lt", threshold: 1700 },
        { type: "heat", symbol: "600519", comparator: "gt", threshold: 80 },
      ],
    },
  };
  const orRule: MonitorRule = {
    severity: "warning",
    condition: {
      type: "composite",
      logic: "OR",
      children: [
        { type: "price", symbol: "600519", comparator: "lt", threshold: 1700 },
        { type: "heat", symbol: "600519", comparator: "gt", threshold: 80 },
      ],
    },
  };

  it("AND requires both", () => {
    expect(
      evaluateRule(
        "a1",
        andRule,
        ctx({ quotes: { "600519": { ...baseQuote, price: 1650, heat: 90 } } }),
      ).triggered,
    ).toBe(true);
    expect(
      evaluateRule(
        "a2",
        andRule,
        ctx({ quotes: { "600519": { ...baseQuote, price: 1650, heat: 50 } } }),
      ).triggered,
    ).toBe(false);
  });

  it("OR requires either", () => {
    expect(
      evaluateRule(
        "o1",
        orRule,
        ctx({ quotes: { "600519": { ...baseQuote, price: 1800, heat: 90 } } }),
      ).triggered,
    ).toBe(true);
    expect(
      evaluateRule(
        "o2",
        orRule,
        ctx({ quotes: { "600519": { ...baseQuote, price: 1800, heat: 50 } } }),
      ).triggered,
    ).toBe(false);
  });
});
