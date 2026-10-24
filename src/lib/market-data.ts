import { prisma } from "./db";
import { normalizeQuoteAfterOverride } from "./quote-override";
import type { CalendarItem, EvalContext, MarketEvent, MarketQuote } from "./types";

/**
 * 模拟行情数据源 —— 所有数据均明确标记 source: "SIMULATED"。
 * 非实时行情，仅用于本地演示与规则引擎验证。
 *
 * 演示用 fault/overrides 会写入 SystemMeta，进程重启后可恢复。
 * 基准价表仍为代码内置常量（可复现）。
 */

export type FaultMode = "none" | "timeout" | "conflict" | "stale";

const META_KEY = "market_demo_state";

interface MarketState {
  basePrices: Record<string, { name: string; price: number; heat: number }>;
  tick: number;
  fault: FaultMode;
  overrides: Record<string, Partial<MarketQuote>>;
}

const globalForMarket = globalThis as unknown as {
  __swMarket?: MarketState;
  __swMarketHydrated?: boolean;
};

function defaultState(): MarketState {
  return {
    basePrices: {
      "600519": { name: "贵州茅台", price: 1688, heat: 72 },
      "300750": { name: "宁德时代", price: 198.5, heat: 81 },
      "002594": { name: "比亚迪", price: 268.2, heat: 76 },
      "601318": { name: "中国平安", price: 48.6, heat: 55 },
      "600036": { name: "招商银行", price: 36.8, heat: 60 },
      "000300": { name: "沪深300", price: 3920, heat: 40 },
      "000001": { name: "上证指数", price: 3120, heat: 35 },
      "399006": { name: "创业板指", price: 2080, heat: 45 },
      HSTECH: { name: "恒生科技", price: 4280, heat: 58 },
      "00700": { name: "腾讯控股", price: 380, heat: 70 },
      "09988": { name: "阿里巴巴", price: 88, heat: 65 },
    },
    tick: 0,
    fault: "none",
    overrides: {},
  };
}

function state(): MarketState {
  if (!globalForMarket.__swMarket) {
    globalForMarket.__swMarket = defaultState();
  }
  return globalForMarket.__swMarket;
}

function wander(price: number, tick: number, seed: number): number {
  const wave = Math.sin((tick + seed) / 3) * 0.004 + Math.cos((tick + seed) / 7) * 0.002;
  return Math.round(price * (1 + wave) * 100) / 100;
}

async function persistMarketState(): Promise<void> {
  const s = state();
  const payload = JSON.stringify({
    fault: s.fault,
    overrides: s.overrides,
    tick: s.tick,
  });
  try {
    await prisma.systemMeta.upsert({
      where: { key: META_KEY },
      create: { key: META_KEY, value: payload },
      update: { value: payload },
    });
  } catch (err) {
    console.warn("[market-data] persist failed", err);
  }
}

/** 从数据库恢复演示行情状态（fault/overrides）；可安全重复调用 */
export async function hydrateMarketState(): Promise<void> {
  if (globalForMarket.__swMarketHydrated) return;
  try {
    const row = await prisma.systemMeta.findUnique({ where: { key: META_KEY } });
    if (row?.value) {
      const parsed = JSON.parse(row.value) as {
        fault?: FaultMode;
        overrides?: Record<string, Partial<MarketQuote>>;
        tick?: number;
      };
      const s = state();
      if (parsed.fault) s.fault = parsed.fault;
      if (parsed.overrides && typeof parsed.overrides === "object") s.overrides = parsed.overrides;
      if (typeof parsed.tick === "number") s.tick = parsed.tick;
    }
    // 可选：环境变量注入一次性演示覆盖（JSON）
    const seed = process.env.DEMO_MARKET_SEED_JSON?.trim();
    if (seed) {
      try {
        const parsed = JSON.parse(seed) as {
          fault?: FaultMode;
          overrides?: Record<string, Partial<MarketQuote>>;
        };
        const s = state();
        if (parsed.fault) s.fault = parsed.fault;
        if (parsed.overrides) s.overrides = { ...s.overrides, ...parsed.overrides };
      } catch {
        console.warn("[market-data] DEMO_MARKET_SEED_JSON 解析失败，已忽略");
      }
    }
  } catch (err) {
    console.warn("[market-data] hydrate skipped", err);
  } finally {
    globalForMarket.__swMarketHydrated = true;
  }
}

export function setFaultMode(mode: FaultMode): void {
  state().fault = mode;
  void persistMarketState();
}

export async function setFaultModeAsync(mode: FaultMode): Promise<void> {
  state().fault = mode;
  await persistMarketState();
}

export function getFaultMode(): FaultMode {
  return state().fault;
}

export function setQuoteOverride(symbol: string, patch: Partial<MarketQuote>): void {
  state().overrides[symbol] = { ...state().overrides[symbol], ...patch };
  void persistMarketState();
}

export async function setQuoteOverrideAsync(
  symbol: string,
  patch: Partial<MarketQuote>,
): Promise<void> {
  state().overrides[symbol] = { ...state().overrides[symbol], ...patch };
  await persistMarketState();
}

export function clearQuoteOverride(symbol?: string): void {
  if (symbol) delete state().overrides[symbol];
  else state().overrides = {};
  void persistMarketState();
}

export async function clearQuoteOverrideAsync(symbol?: string): Promise<void> {
  if (symbol) delete state().overrides[symbol];
  else state().overrides = {};
  await persistMarketState();
}

export function listSymbols(): Array<{ symbol: string; name: string; basePrice: number }> {
  return Object.entries(state().basePrices).map(([symbol, v]) => ({
    symbol,
    name: v.name,
    basePrice: v.price,
  }));
}

export function getQuotes(now = new Date()): Record<string, MarketQuote> {
  const s = state();
  s.tick += 1;
  const freshnessSec = 60;
  const asOf =
    s.fault === "stale"
      ? new Date(now.getTime() - 10 * 60 * 1000).toISOString()
      : now.toISOString();

  const quotes: Record<string, MarketQuote> = {};
  let i = 0;
  for (const [symbol, base] of Object.entries(s.basePrices)) {
    const price = wander(base.price, s.tick, i++);
    const prevClose = base.price;
    const changePct = ((price - prevClose) / prevClose) * 100;
    const heat = Math.min(100, Math.max(0, Math.round(base.heat + Math.sin(s.tick / 5 + i) * 5)));
    const q: MarketQuote = {
      symbol,
      name: base.name,
      price,
      prevClose,
      changePct: Math.round(changePct * 100) / 100,
      heat,
      volume: Math.round(1_000_000 + s.tick * 1000 + i * 5000),
      asOf,
      source: "SIMULATED",
      stale: s.fault === "stale",
      freshnessSec,
    };
    const ov = s.overrides[symbol];
    if (ov) {
      Object.assign(q, ov);
      Object.assign(q, normalizeQuoteAfterOverride(q));
    }
    quotes[symbol] = q;
  }

  return quotes;
}

export function getEvents(now = new Date()): MarketEvent[] {
  const day = now.toISOString().slice(0, 10);
  return [
    {
      id: "evt-mt-1",
      symbol: "600519",
      title: "贵州茅台发布董事会决议公告",
      keywords: ["公告", "董事会"],
      publishedAt: day,
      source: "SIMULATED",
    },
    {
      id: "evt-nd-1",
      symbol: "300750",
      title: "宁德时代获机构调研关注",
      keywords: ["调研", "关注"],
      publishedAt: day,
      source: "SIMULATED",
    },
  ];
}

export function getCalendar(now = new Date()): CalendarItem[] {
  const in5 = new Date(now.getTime() + 5 * 86400000).toISOString().slice(0, 10);
  const in12 = new Date(now.getTime() + 12 * 86400000).toISOString().slice(0, 10);
  return [
    {
      id: "cal-1",
      symbol: "600519",
      eventType: "earnings",
      title: "贵州茅台预计财报窗口",
      date: in5,
      source: "SIMULATED",
    },
    {
      id: "cal-2",
      symbol: "300750",
      eventType: "lockup",
      title: "宁德时代解禁观察日",
      date: in12,
      source: "SIMULATED",
    },
  ];
}

export function buildEvalContext(now = new Date()): EvalContext {
  const fault = state().fault;
  if (fault === "timeout") {
    return {
      quotes: {},
      events: [],
      calendar: [],
      now,
      dataFault: "timeout",
    };
  }
  return {
    quotes: getQuotes(now),
    events: getEvents(now),
    calendar: getCalendar(now),
    now,
    dataFault: fault === "none" ? null : fault,
  };
}

export const DATA_DISCLAIMER =
  "当前行情/事件/日历均为 SIMULATED 模拟数据，非实时行情，仅供规则引擎与产品流程演示，关键数字可追溯至本模块生成逻辑。";
