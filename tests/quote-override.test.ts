import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { evaluateRule } from "../src/lib/rule-engine";
import {
  buildPriceOverridePatch,
  normalizeQuoteAfterOverride,
} from "../src/lib/quote-override";
import {
  buildEvalContext,
  clearQuoteOverride,
  setFaultMode,
  setQuoteOverride,
} from "../src/lib/market-data";
import type { EvalContext, MonitorRule } from "../src/lib/types";

const crossBelowRule: MonitorRule = {
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

function quoteCtx(price: number, prevClose: number, fault: EvalContext["dataFault"] = null): EvalContext {
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

describe("buildPriceOverridePatch", () => {
  it("builds patch with changePct from price and prevClose (demo: 1650 / 1720)", () => {
    const r = buildPriceOverridePatch(1650, 1720);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.patch.price).toBe(1650);
    expect(r.patch.prevClose).toBe(1720);
    expect(r.patch.changePct).toBe(-4.07);
    expect(r.patch.source).toBe("SIMULATED");
  });

  it("does not hardcode prevClose 1688 when computing changePct", () => {
    const r = buildPriceOverridePatch(1650, 1720);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const wrongIfHardcoded1688 =
      Math.round(-((1688 - 1650) / 1688) * 10000) / 100;
    expect(r.patch.changePct).not.toBe(wrongIfHardcoded1688);
  });

  it("rejects non-finite / non-positive prices", () => {
    expect(buildPriceOverridePatch(NaN, 1720).ok).toBe(false);
    expect(buildPriceOverridePatch(1650, Infinity).ok).toBe(false);
    expect(buildPriceOverridePatch(0, 1720).ok).toBe(false);
    expect(buildPriceOverridePatch(-1, 1720).ok).toBe(false);
    expect(buildPriceOverridePatch(1650, 0).ok).toBe(false);
  });
});

describe("cross_below 1700 with editable prevClose", () => {
  it("triggers when prevClose=1720 and price=1650", () => {
    const r = evaluateRule("demo-trigger", crossBelowRule, quoteCtx(1650, 1720));
    expect(r.triggered).toBe(true);
    expect(r.degraded).toBeFalsy();
  });

  it("does not treat as new breakdown when prevClose=1688 and price=1650", () => {
    const r = evaluateRule("demo-no-cross", crossBelowRule, quoteCtx(1650, 1688));
    expect(r.triggered).toBe(false);
  });

  it("degrades on timeout / stale without false trigger", () => {
    const timeout = evaluateRule("demo-to", crossBelowRule, quoteCtx(1650, 1720, "timeout"));
    expect(timeout.degraded).toBe(true);
    expect(timeout.triggered).toBe(false);

    const stale = evaluateRule("demo-stale", crossBelowRule, quoteCtx(1650, 1720, "stale"));
    expect(stale.degraded).toBe(true);
    expect(stale.triggered).toBe(false);
  });
});

describe("normalizeQuoteAfterOverride", () => {
  it("recomputes changePct from price and prevClose", () => {
    const q = normalizeQuoteAfterOverride({
      symbol: "600519",
      name: "贵州茅台",
      price: 1650,
      prevClose: 1720,
      changePct: 999,
      heat: 70,
      volume: 1,
      asOf: new Date().toISOString(),
      source: "SIMULATED",
      freshnessSec: 60,
    });
    expect(q.changePct).toBe(-4.07);
    expect(q.source).toBe("SIMULATED");
  });
});

describe("market override integration (in-memory)", () => {
  beforeEach(() => {
    setFaultMode("none");
    clearQuoteOverride();
  });

  afterEach(() => {
    setFaultMode("none");
    clearQuoteOverride();
  });

  it("applies prevClose override so quote table / engine see 1720 not base 1688", () => {
    const built = buildPriceOverridePatch(1650, 1720);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    setQuoteOverride("600519", built.patch);
    const ctx = buildEvalContext();
    const q = ctx.quotes["600519"];
    expect(q.price).toBe(1650);
    expect(q.prevClose).toBe(1720);
    expect(q.changePct).toBeCloseTo(((1650 - 1720) / 1720) * 100, 2);
    expect(q.source).toBe("SIMULATED");

    const evalResult = evaluateRule("ov-int", crossBelowRule, ctx);
    expect(evalResult.triggered).toBe(true);
  });

  it("clearOverride restores default simulated quote behavior", () => {
    const built = buildPriceOverridePatch(1650, 1720);
    if (!built.ok) throw new Error("unexpected");
    setQuoteOverride("600519", built.patch);
    clearQuoteOverride();
    const ctx = buildEvalContext();
    const q = ctx.quotes["600519"];
    // 默认基准 prevClose = base 1688；价格在 wander 附近，不应再是强制 1650
    expect(q.prevClose).toBe(1688);
    expect(q.price).not.toBe(1650);
    expect(q.source).toBe("SIMULATED");
  });
});
