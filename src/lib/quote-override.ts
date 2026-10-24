import type { MarketQuote } from "./types";

/** 演示默认：当前价 1650 / 前收 1720，可构造「跌破 1700」情景 */
export const DEMO_OVERRIDE_PRICE = 1650;
export const DEMO_OVERRIDE_PREV_CLOSE = 1720;

export function isValidPositivePrice(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export type PriceOverrideResult =
  | {
      ok: true;
      patch: Pick<MarketQuote, "price" | "prevClose" | "changePct" | "source">;
    }
  | { ok: false; error: string };

/**
 * 根据「当前模拟价 + 模拟前收盘价」生成覆盖补丁。
 * 涨跌幅必须由二者计算，禁止硬编码基准价。
 */
export function buildPriceOverridePatch(
  price: unknown,
  prevClose: unknown,
): PriceOverrideResult {
  if (!isValidPositivePrice(price)) {
    return { ok: false, error: "当前模拟价格必须是大于 0 的有限数字" };
  }
  if (!isValidPositivePrice(prevClose)) {
    return { ok: false, error: "模拟前收盘价必须是大于 0 的有限数字" };
  }
  const changePct = Math.round(((price - prevClose) / prevClose) * 10000) / 100;
  return {
    ok: true,
    patch: {
      price,
      prevClose,
      changePct,
      source: "SIMULATED",
    },
  };
}

/** 覆盖合并后统一用 price/prevClose 重算涨跌幅，并强制 SIMULATED */
export function normalizeQuoteAfterOverride(q: MarketQuote): MarketQuote {
  const next = { ...q, source: "SIMULATED" as const };
  if (isValidPositivePrice(next.price) && isValidPositivePrice(next.prevClose)) {
    next.changePct =
      Math.round(((next.price - next.prevClose) / next.prevClose) * 10000) / 100;
  }
  return next;
}
