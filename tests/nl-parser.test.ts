import { describe, expect, it } from "vitest";
import { parseNaturalLanguage, describeRule } from "../src/lib/nl-parser";

describe("nl-parser", () => {
  it("parses price cross-below rule", () => {
    const r = parseNaturalLanguage("贵州茅台跌破1700元提醒我");
    expect(r.success).toBe(true);
    expect(r.rule?.condition.type).toBe("price");
    if (r.rule?.condition.type === "price") {
      expect(r.rule.condition.symbol).toBe("600519");
      expect(r.rule.condition.threshold).toBe(1700);
      expect(r.rule.condition.comparator).toBe("cross_below");
    }
    expect(describeRule(r.rule!)).toContain("贵州茅台");
  });

  it("parses composite change and heat", () => {
    const r = parseNaturalLanguage("宁德时代跌超5%并且热度超过80");
    expect(r.success).toBe(true);
    expect(r.rule?.condition.type).toBe("composite");
  });

  it("fails gracefully on empty", () => {
    const r = parseNaturalLanguage("   ");
    expect(r.success).toBe(false);
  });
});
