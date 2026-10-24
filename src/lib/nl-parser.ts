import type {
  Comparator,
  MonitorRule,
  ParseResult,
  RuleCondition,
} from "./types";

/** 常见标的别名表（模拟行情可覆盖） */
const SYMBOL_ALIASES: Record<string, { symbol: string; name: string }> = {
  贵州茅台: { symbol: "600519", name: "贵州茅台" },
  茅台: { symbol: "600519", name: "贵州茅台" },
  宁德时代: { symbol: "300750", name: "宁德时代" },
  比亚迪: { symbol: "002594", name: "比亚迪" },
  中国平安: { symbol: "601318", name: "中国平安" },
  平安: { symbol: "601318", name: "中国平安" },
  招商银行: { symbol: "600036", name: "招商银行" },
  招商: { symbol: "600036", name: "招商银行" },
  沪深300: { symbol: "000300", name: "沪深300" },
  上证指数: { symbol: "000001", name: "上证指数" },
  创业板指: { symbol: "399006", name: "创业板指" },
  恒生科技: { symbol: "HSTECH", name: "恒生科技" },
  腾讯: { symbol: "00700", name: "腾讯控股" },
  阿里: { symbol: "09988", name: "阿里巴巴" },
};

function findSymbol(text: string): { symbol: string; name: string } | null {
  const codeMatch = text.match(/\b(\d{6})\b/) || text.match(/\b(\d{5})\b/);
  if (codeMatch) {
    const symbol = codeMatch[1];
    const known = Object.values(SYMBOL_ALIASES).find((s) => s.symbol === symbol);
    return known ?? { symbol, name: symbol };
  }
  for (const [alias, info] of Object.entries(SYMBOL_ALIASES)) {
    if (text.includes(alias)) return info;
  }
  return null;
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").replace(/元/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function severityFromText(text: string): MonitorRule["severity"] {
  if (/紧急|严重|立刻|马上/.test(text)) return "critical";
  if (/提醒|关注|留意/.test(text)) return "info";
  return "warning";
}

function comparatorFromPhrase(phrase: string): Comparator | null {
  if (/跌破|下破|跌穿|低于|小于|不到/.test(phrase)) {
    if (/跌破|下破|跌穿/.test(phrase)) return "cross_below";
    return "lt";
  }
  if (/突破|上破|涨破|高于|超过|大于/.test(phrase)) {
    if (/突破|上破|涨破/.test(phrase)) return "cross_above";
    return "gt";
  }
  if (/等于|到达|达到/.test(phrase)) return "eq";
  return null;
}

/**
 * 将中文自然语言关注点解析为可检查、可编辑的结构化规则。
 * 采用确定性规则解析（非 LLM），保证可复现、可测试。
 */
export function parseNaturalLanguage(rawText: string): ParseResult {
  const text = rawText.trim();
  const warnings: string[] = [];

  if (!text) {
    return {
      success: false,
      rule: null,
      confidence: 0,
      warnings: ["输入为空"],
      rawText: text,
    };
  }

  const symbolInfo = findSymbol(text);
  if (!symbolInfo) {
    warnings.push("未能识别证券代码或名称，请手动补充标的");
  }

  const conditions: RuleCondition[] = [];
  let confidence = 0.4;

  // 价格条件：跌破/突破/低于/高于 xxx
  const pricePatterns = [
    /(跌破|下破|跌穿|低于|小于|不到|突破|上破|涨破|高于|超过|大于|等于|到达|达到)\s*([\d,.]+)\s*元?/,
    /价格\s*(跌破|低于|高于|超过|突破)\s*([\d,.]+)/,
  ];
  for (const re of pricePatterns) {
    const m = text.match(re);
    if (m) {
      const cmp = comparatorFromPhrase(m[1]);
      const threshold = parseNumber(m[2]);
      if (cmp && threshold !== null && symbolInfo) {
        conditions.push({
          type: "price",
          symbol: symbolInfo.symbol,
          symbolName: symbolInfo.name,
          comparator: cmp,
          threshold,
          label: `价格${m[1]}${threshold}`,
        });
        confidence += 0.25;
        break;
      }
    }
  }

  // 涨跌幅：跌超/涨超/跌幅超过 x%
  const pctMatch = text.match(
    /(跌超|跌幅超过|下跌超过|跌了超过|涨超|涨幅超过|上涨超过|涨了超过|涨跌幅(?:低于|高于|超过))\s*([\d.]+)\s*%?/,
  );
  if (pctMatch && symbolInfo) {
    const isDown = /跌/.test(pctMatch[1]);
    const abs = parseNumber(pctMatch[2]);
    if (abs !== null) {
      conditions.push({
        type: "change_pct",
        symbol: symbolInfo.symbol,
        symbolName: symbolInfo.name,
        comparator: isDown ? "lte" : "gte",
        threshold: isDown ? -Math.abs(abs) : Math.abs(abs),
        label: `涨跌幅${isDown ? "≤" : "≥"}${isDown ? -Math.abs(abs) : Math.abs(abs)}%`,
      });
      confidence += 0.2;
    }
  }

  // 热度
  const heatMatch = text.match(/(热度|关注度|人气)\s*(超过|高于|大于|低于|小于)\s*([\d.]+)/);
  if (heatMatch && symbolInfo) {
    const cmp = comparatorFromPhrase(heatMatch[2]) ?? "gt";
    const threshold = parseNumber(heatMatch[3]);
    if (threshold !== null) {
      conditions.push({
        type: "heat",
        symbol: symbolInfo.symbol,
        symbolName: symbolInfo.name,
        comparator: cmp === "cross_above" ? "gt" : cmp === "cross_below" ? "lt" : cmp,
        threshold,
        label: `热度${heatMatch[2]}${threshold}`,
      });
      confidence += 0.15;
    }
  }

  // 事件关键词
  const eventKeywords: string[] = [];
  const eventHints = ["财报", "业绩", "公告", "减持", "增持", "回购", "停牌", "复牌", "立案", "处罚"];
  for (const k of eventHints) {
    if (text.includes(k)) eventKeywords.push(k);
  }
  if (/出现|发布|有.*公告|有.*消息/.test(text) && eventKeywords.length === 0) {
    eventKeywords.push("公告");
  }
  if (eventKeywords.length > 0) {
    conditions.push({
      type: "event",
      symbol: symbolInfo?.symbol,
      symbolName: symbolInfo?.name,
      keywords: eventKeywords,
      label: `事件含[${eventKeywords.join(",")}]`,
    });
    confidence += 0.15;
  }

  // 日历：N 天内财报/除权
  const calMatch = text.match(/(\d+)\s*天内.*(财报|业绩|除权|解禁)/);
  if (calMatch) {
    const withinDays = Number(calMatch[1]);
    const typeMap: Record<string, "earnings" | "ex_dividend" | "lockup"> = {
      财报: "earnings",
      业绩: "earnings",
      除权: "ex_dividend",
      解禁: "lockup",
    };
    conditions.push({
      type: "calendar",
      eventType: typeMap[calMatch[2]] ?? "custom",
      withinDays,
      symbol: symbolInfo?.symbol,
      symbolName: symbolInfo?.name,
      label: `${withinDays}天内${calMatch[2]}`,
    });
    confidence += 0.15;
  }

  if (conditions.length === 0) {
    // 兜底：若仅识别到标的，生成可编辑的默认价格关注模板
    if (symbolInfo) {
      conditions.push({
        type: "price",
        symbol: symbolInfo.symbol,
        symbolName: symbolInfo.name,
        comparator: "lt",
        threshold: 0,
        label: "价格低于阈值（请编辑阈值）",
      });
      warnings.push("未能解析出明确阈值，已生成可编辑的默认价格规则，请补充阈值后保存");
      confidence = 0.35;
    } else {
      return {
        success: false,
        rule: null,
        confidence: 0,
        warnings: ["无法解析为可执行规则，请尝试如：「贵州茅台跌破1700元提醒我」"],
        rawText: text,
      };
    }
  }

  const logic: "AND" | "OR" = /同时|并且|且|以及/.test(text)
    ? "AND"
    : /或者|或/.test(text)
      ? "OR"
      : "AND";

  const condition: RuleCondition =
    conditions.length === 1
      ? conditions[0]
      : {
          type: "composite",
          logic,
          children: conditions,
          label: `组合条件(${logic})`,
        };

  const rule: MonitorRule = {
    symbol: symbolInfo?.symbol,
    symbolName: symbolInfo?.name,
    condition,
    severity: severityFromText(text),
    notes: `由自然语言解析生成：${text.slice(0, 80)}`,
  };

  confidence = Math.min(0.95, confidence);

  return {
    success: true,
    rule,
    confidence,
    warnings,
    rawText: text,
  };
}

export function describeRule(rule: MonitorRule): string {
  return describeCondition(rule.condition);
}

function describeCondition(c: RuleCondition): string {
  switch (c.type) {
    case "price":
      return `${c.symbolName ?? c.symbol} 价格 ${cmpLabel(c.comparator)} ${c.threshold}`;
    case "change_pct":
      return `${c.symbolName ?? c.symbol} 涨跌幅 ${cmpLabel(c.comparator)} ${c.threshold}%`;
    case "heat":
      return `${c.symbolName ?? c.symbol} 热度 ${cmpLabel(c.comparator)} ${c.threshold}`;
    case "event":
      return `事件关键词包含 ${c.keywords.join("/")}`;
    case "calendar":
      return `${c.withinDays} 天内存在 ${c.eventType}`;
    case "composite":
      return c.children.map(describeCondition).join(` ${c.logic} `);
    default:
      return "未知条件";
  }
}

function cmpLabel(c: Comparator): string {
  const map: Record<Comparator, string> = {
    lt: "<",
    lte: "≤",
    gt: ">",
    gte: "≥",
    eq: "=",
    cross_below: "跌破",
    cross_above: "突破",
  };
  return map[c];
}

export { SYMBOL_ALIASES };
