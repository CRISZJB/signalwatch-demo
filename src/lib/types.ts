/** 统一条件模型：价格 / 涨跌幅 / 热度 / 事件 / 日历 / 组合 */
export type ConditionType =
  | "price"
  | "change_pct"
  | "heat"
  | "event"
  | "calendar"
  | "composite";

export type Comparator = "lt" | "lte" | "gt" | "gte" | "eq" | "cross_below" | "cross_above";

export interface BaseCondition {
  type: ConditionType;
  label?: string;
}

export interface PriceCondition extends BaseCondition {
  type: "price";
  symbol: string;
  symbolName?: string;
  comparator: Comparator;
  threshold: number;
}

export interface ChangePctCondition extends BaseCondition {
  type: "change_pct";
  symbol: string;
  symbolName?: string;
  comparator: Comparator;
  threshold: number; // 百分比数值，如 -3 表示跌 3%
}

export interface HeatCondition extends BaseCondition {
  type: "heat";
  symbol: string;
  symbolName?: string;
  comparator: Comparator;
  threshold: number; // 热度指数 0-100
}

export interface EventCondition extends BaseCondition {
  type: "event";
  symbol?: string;
  symbolName?: string;
  keywords: string[];
}

export interface CalendarCondition extends BaseCondition {
  type: "calendar";
  eventType: "earnings" | "ex_dividend" | "lockup" | "custom";
  withinDays: number;
  symbol?: string;
  symbolName?: string;
}

export interface CompositeCondition extends BaseCondition {
  type: "composite";
  logic: "AND" | "OR";
  children: RuleCondition[];
}

export type RuleCondition =
  | PriceCondition
  | ChangePctCondition
  | HeatCondition
  | EventCondition
  | CalendarCondition
  | CompositeCondition;

export interface MonitorRule {
  symbol?: string;
  symbolName?: string;
  condition: RuleCondition;
  severity: "info" | "warning" | "critical";
  notes?: string;
}

export type TaskStatus = "ACTIVE" | "PAUSED" | "DEGRADED";

export type ExecutionOutcome =
  | "TRIGGERED"
  | "NOT_TRIGGERED"
  | "SKIPPED"
  | "DEGRADED"
  | "ERROR";

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  changePct: number;
  heat: number;
  volume: number;
  /** 数据时间戳 */
  asOf: string;
  /** 明确标识：SIMULATED | LIVE */
  source: "SIMULATED" | "LIVE";
  /** 是否过期（超过 freshnessSec） */
  stale?: boolean;
  freshnessSec: number;
}

export interface MarketEvent {
  id: string;
  symbol?: string;
  title: string;
  keywords: string[];
  publishedAt: string;
  source: "SIMULATED" | "LIVE";
}

export interface CalendarItem {
  id: string;
  symbol?: string;
  eventType: "earnings" | "ex_dividend" | "lockup" | "custom";
  title: string;
  date: string;
  source: "SIMULATED" | "LIVE";
}

export interface EvalContext {
  quotes: Record<string, MarketQuote>;
  events: MarketEvent[];
  calendar: CalendarItem[];
  now: Date;
  /** 数据源异常注入标志 */
  dataFault?: "timeout" | "conflict" | "stale" | null;
}

export interface ConditionEvalResult {
  matched: boolean;
  explanation: string;
  observed?: Record<string, unknown>;
}

export interface RuleEvalResult {
  triggered: boolean;
  explanation: string;
  severity: MonitorRule["severity"];
  fingerprint: string;
  observed: Record<string, unknown>;
  degraded?: boolean;
  degradeReason?: string;
}

export interface ParseResult {
  success: boolean;
  rule: MonitorRule | null;
  confidence: number;
  warnings: string[];
  rawText: string;
}
