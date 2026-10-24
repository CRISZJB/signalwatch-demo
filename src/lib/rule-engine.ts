import { createHash } from "crypto";
import type {
  Comparator,
  ConditionEvalResult,
  EvalContext,
  MarketQuote,
  MonitorRule,
  RuleCondition,
  RuleEvalResult,
} from "./types";

function compare(value: number, comparator: Comparator, threshold: number, prev?: number): boolean {
  switch (comparator) {
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "eq":
      return Math.abs(value - threshold) < 1e-6;
    case "cross_below":
      // 当前价低于阈值，且前收盘在阈值之上（或等于）→ 视为跌破
      if (prev === undefined) return value < threshold;
      return prev >= threshold && value < threshold;
    case "cross_above":
      if (prev === undefined) return value > threshold;
      return prev <= threshold && value > threshold;
    default:
      return false;
  }
}

/** 校验行情字段；返回错误说明，合法则返回 null */
export function validateQuote(q: Partial<MarketQuote> | null | undefined, symbol: string): string | null {
  if (!q || typeof q !== "object") {
    return `标的 ${symbol} 行情对象缺失或类型错误`;
  }
  if (typeof q.price !== "number" || !Number.isFinite(q.price)) {
    return `标的 ${symbol} 价格非法（期望有限 number，实际=${String(q.price)}）`;
  }
  if (typeof q.prevClose !== "number" || !Number.isFinite(q.prevClose)) {
    return `标的 ${symbol} 前收盘价非法`;
  }
  if (typeof q.changePct !== "number" || !Number.isFinite(q.changePct)) {
    return `标的 ${symbol} 涨跌幅非法`;
  }
  if (typeof q.heat !== "number" || !Number.isFinite(q.heat)) {
    return `标的 ${symbol} 热度非法`;
  }
  if (!q.asOf || typeof q.asOf !== "string") {
    return `标的 ${symbol} 缺少有效 asOf 时间`;
  }
  if (q.source !== "SIMULATED" && q.source !== "LIVE") {
    return `标的 ${symbol} 数据来源标记非法`;
  }
  return null;
}

function evalCondition(condition: RuleCondition, ctx: EvalContext): ConditionEvalResult {
  switch (condition.type) {
    case "price": {
      const q = ctx.quotes[condition.symbol];
      if (!q) {
        return {
          matched: false,
          explanation: `缺少 ${condition.symbol} 行情数据，无法判断价格条件`,
        };
      }
      const bad = validateQuote(q, condition.symbol);
      if (bad) {
        return { matched: false, explanation: bad, observed: { malformed: true } };
      }
      if (q.stale) {
        return {
          matched: false,
          explanation: `${q.name} 行情已过期（asOf=${q.asOf}），价格条件暂不判定为触发`,
          observed: { price: q.price, stale: true },
        };
      }
      const matched = compare(q.price, condition.comparator, condition.threshold, q.prevClose);
      return {
        matched,
        explanation: matched
          ? `${q.name} 现价 ${q.price} ${condition.comparator} ${condition.threshold}（前收 ${q.prevClose}）→ 满足`
          : `${q.name} 现价 ${q.price}，阈值 ${condition.threshold}，比较符 ${condition.comparator} → 未满足`,
        observed: {
          symbol: q.symbol,
          price: q.price,
          prevClose: q.prevClose,
          threshold: condition.threshold,
          source: q.source,
          asOf: q.asOf,
        },
      };
    }
    case "change_pct": {
      const q = ctx.quotes[condition.symbol];
      if (!q) {
        return {
          matched: false,
          explanation: `缺少 ${condition.symbol} 行情，无法判断涨跌幅`,
        };
      }
      const bad = validateQuote(q, condition.symbol);
      if (bad) {
        return { matched: false, explanation: bad, observed: { malformed: true } };
      }
      const matched = compare(q.changePct, condition.comparator, condition.threshold);
      return {
        matched,
        explanation: matched
          ? `${q.name} 涨跌幅 ${q.changePct.toFixed(2)}% 满足阈值 ${condition.threshold}%`
          : `${q.name} 涨跌幅 ${q.changePct.toFixed(2)}%，未达阈值 ${condition.threshold}%`,
        observed: {
          changePct: q.changePct,
          threshold: condition.threshold,
          source: q.source,
        },
      };
    }
    case "heat": {
      const q = ctx.quotes[condition.symbol];
      if (!q) {
        return { matched: false, explanation: `缺少 ${condition.symbol} 热度数据` };
      }
      const bad = validateQuote(q, condition.symbol);
      if (bad) {
        return { matched: false, explanation: bad, observed: { malformed: true } };
      }
      const matched = compare(q.heat, condition.comparator, condition.threshold);
      return {
        matched,
        explanation: matched
          ? `${q.name} 热度 ${q.heat} 满足阈值 ${condition.threshold}`
          : `${q.name} 热度 ${q.heat}，未达阈值 ${condition.threshold}`,
        observed: { heat: q.heat, threshold: condition.threshold, source: q.source },
      };
    }
    case "event": {
      const hits = ctx.events.filter((e) => {
        if (!e || typeof e.id !== "string" || !e.title) return false;
        const symbolOk = !condition.symbol || e.symbol === condition.symbol;
        const kwOk = condition.keywords.some(
          (k) => e.title.includes(k) || (e.keywords ?? []).some((ek) => ek.includes(k)),
        );
        return symbolOk && kwOk;
      });
      // 同一事件 id 重复出现时按唯一 id 计入指纹，避免重复条目改变判定语义
      const uniqueIds = [...new Set(hits.map((h) => h.id))];
      const uniqueHits = uniqueIds.map((id) => hits.find((h) => h.id === id)!);
      return {
        matched: uniqueHits.length > 0,
        explanation:
          uniqueHits.length > 0
            ? `命中事件：${uniqueHits.map((h) => h.title).join("；")}${hits.length > uniqueHits.length ? `（输入含重复事件 ${hits.length - uniqueHits.length} 条，已按 id 去重）` : ""}`
            : `未发现含关键词 [${condition.keywords.join(",")}] 的近期事件`,
        observed: {
          hitCount: uniqueHits.length,
          rawHitCount: hits.length,
          duplicateCollapsed: hits.length - uniqueHits.length,
          hits: uniqueIds,
        },
      };
    }
    case "calendar": {
      const now = ctx.now.getTime();
      const hits = ctx.calendar.filter((c) => {
        const symbolOk = !condition.symbol || c.symbol === condition.symbol;
        const typeOk = c.eventType === condition.eventType;
        const days = (new Date(c.date).getTime() - now) / (86400 * 1000);
        return symbolOk && typeOk && days >= 0 && days <= condition.withinDays;
      });
      return {
        matched: hits.length > 0,
        explanation:
          hits.length > 0
            ? `日历命中：${hits.map((h) => `${h.title}(${h.date})`).join("；")}`
            : `未来 ${condition.withinDays} 天内无 ${condition.eventType} 事件`,
        observed: { hitCount: hits.length },
      };
    }
    case "composite": {
      const childResults = condition.children.map((ch) => evalCondition(ch, ctx));
      const matched =
        condition.logic === "AND"
          ? childResults.every((r) => r.matched)
          : childResults.some((r) => r.matched);
      return {
        matched,
        explanation: `组合(${condition.logic}): ${childResults.map((r) => r.explanation).join(" | ")}`,
        observed: { children: childResults.map((r) => r.observed) },
      };
    }
    default:
      return { matched: false, explanation: "未知条件类型" };
  }
}

function buildFingerprint(taskId: string, rule: MonitorRule, observed: Record<string, unknown>): string {
  const payload = JSON.stringify({
    taskId,
    condition: rule.condition,
    // 指纹按「规则 + 关键观测桶」去重，避免同一状态重复告警
    bucket: {
      priceBucket:
        typeof observed.price === "number" ? Math.round(Number(observed.price) * 10) / 10 : null,
      changeBucket:
        typeof observed.changePct === "number"
          ? Math.round(Number(observed.changePct) * 10) / 10
          : null,
      heatBucket: typeof observed.heat === "number" ? Math.round(Number(observed.heat)) : null,
      events: observed.hits ?? null,
    },
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 24);
}

/**
 * 真实规则引擎：根据结构化规则与行情上下文判定是否触发。
 */
export function evaluateRule(
  taskId: string,
  rule: MonitorRule,
  ctx: EvalContext,
): RuleEvalResult {
  if (ctx.dataFault === "timeout") {
    return {
      triggered: false,
      explanation: "数据接口超时，本轮降级为不触发，并记录异常以便恢复后继续监控",
      severity: rule.severity,
      fingerprint: "degraded-timeout",
      observed: {},
      degraded: true,
      degradeReason: "行情接口超时",
    };
  }

  if (ctx.dataFault === "conflict") {
    return {
      triggered: false,
      explanation: "检测到同源行情冲突（多源价格不一致），本轮降级跳过触发以避免误报",
      severity: rule.severity,
      fingerprint: "degraded-conflict",
      observed: {},
      degraded: true,
      degradeReason: "行情数据冲突",
    };
  }

  // 仅价格/涨跌幅/热度依赖行情；事件/日历可不依赖 quotes
  const quoteSymbols = collectQuoteSymbols(rule.condition);
  const staleAll =
    quoteSymbols.length > 0 &&
    quoteSymbols.every((s) => !ctx.quotes[s] || ctx.quotes[s].stale);
  if (staleAll || ctx.dataFault === "stale") {
    return {
      triggered: false,
      explanation: "行情数据过期，本轮降级：不触发预警，任务标记为 DEGRADED，数据恢复后自动继续",
      severity: rule.severity,
      fingerprint: "degraded-stale",
      observed: { symbols: quoteSymbols },
      degraded: true,
      degradeReason: "行情数据过期",
    };
  }

  // 格式异常：任一相关报价字段非法 → 降级，绝不误触发
  for (const sym of quoteSymbols) {
    const q = ctx.quotes[sym];
    if (!q) continue;
    const bad = validateQuote(q, sym);
    if (bad) {
      return {
        triggered: false,
        explanation: `数据格式异常，本轮拒绝判定并降级：${bad}`,
        severity: rule.severity,
        fingerprint: "degraded-malformed",
        observed: { symbol: sym, malformed: true },
        degraded: true,
        degradeReason: "行情数据格式异常",
      };
    }
  }

  const result = evalCondition(rule.condition, ctx);
  const observed = (result.observed ?? {}) as Record<string, unknown>;

  // 条件层发现 malformed 时同样不触发
  if (observed.malformed) {
    return {
      triggered: false,
      explanation: result.explanation,
      severity: rule.severity,
      fingerprint: "degraded-malformed",
      observed,
      degraded: true,
      degradeReason: "行情数据格式异常",
    };
  }

  const fingerprint = buildFingerprint(taskId, rule, flattenObserved(observed));

  return {
    triggered: result.matched,
    explanation: result.explanation,
    severity: rule.severity,
    fingerprint,
    observed,
  };
}

/** 需要行情报价的标的（价格/涨跌幅/热度） */
function collectQuoteSymbols(condition: RuleCondition): string[] {
  switch (condition.type) {
    case "price":
    case "change_pct":
    case "heat":
      return [condition.symbol];
    case "composite":
      return [...new Set(condition.children.flatMap(collectQuoteSymbols))];
    default:
      return [];
  }
}

function flattenObserved(obs: Record<string, unknown>): Record<string, unknown> {
  if (obs.price !== undefined || obs.changePct !== undefined || obs.heat !== undefined) {
    return obs;
  }
  // composite: 尝试合并子观测
  const children = obs.children as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(children) && children[0]) {
    return { ...children[0], hits: children.flatMap((c) => (c?.hits as string[]) ?? []) };
  }
  return obs;
}

export function quoteSummary(quotes: Record<string, MarketQuote>): string {
  return Object.values(quotes)
    .map(
      (q) =>
        `${q.name}(${q.symbol})=${q.price} ${q.changePct.toFixed(2)}% 热度${q.heat} [${q.source}${q.stale ? "/过期" : ""}]`,
    )
    .join("; ");
}
