import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|md)$/.test(name)) acc.push(p);
  }
  return acc;
}

describe("compliance static checks (code presence, not full assurance)", () => {
  const root = join(__dirname, "..");
  const srcFiles = walk(join(root, "src"));
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const market = readFileSync(join(root, "src/lib/market-data.ts"), "utf8");
  const nav = readFileSync(join(root, "src/components/Nav.tsx"), "utf8");
  const home = readFileSync(join(root, "src/app/page.tsx"), "utf8");

  it("labels simulated market data explicitly", () => {
    expect(market).toContain('source: "SIMULATED"');
    expect(market).toContain("非实时行情");
    expect(nav).toContain("SIMULATED");
  });

  it("does not claim live realtime quotes in core market module", () => {
    expect(market.includes('source: "LIVE"') && market.includes("实时行情")).toBe(false);
    expect(market).toMatch(/SIMULATED/);
  });

  it("contains investment disclaimer language in README", () => {
    expect(readme).toMatch(/不构成投资建议|合规提示/);
  });

  it("layout footer contains investment disclaimer", () => {
    const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
    expect(layout).toMatch(/不构成投资建议/);
    expect(layout).toMatch(/SIMULATED/);
  });

  it("home page disclaimer mentions simulated data", () => {
    expect(home).toMatch(/SIMULATED|模拟/);
  });

  it("no brokerage order/trade execution modules under src", () => {
    const joined = srcFiles.map((f) => readFileSync(f, "utf8")).join("\n");
    expect(joined).not.toMatch(/placeOrder|autoTrade|自动下单|券商下单/);
  });

  it("frontend source has no hardcoded API secret patterns", () => {
    const clientish = srcFiles.filter((f) => f.includes(`${join("src", "app")}`) || f.includes("components"));
    const blob = clientish.map((f) => readFileSync(f, "utf8")).join("\n");
    expect(blob).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
    expect(blob).not.toMatch(/OPENAI_API_KEY\s*=\s*['\"][^'\"]+['\"]/);
  });
});
