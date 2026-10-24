import { prisma } from "./db";
import { buildEvalContext, DATA_DISCLAIMER, hydrateMarketState } from "./market-data";
import { parseNaturalLanguage, describeRule } from "./nl-parser";
import { evaluateRule, quoteSummary } from "./rule-engine";
import type { EvalContext, MonitorRule, ParseResult } from "./types";

export function parseRuleText(text: string): ParseResult {
  return parseNaturalLanguage(text);
}

export async function createTask(input: {
  name?: string;
  naturalLanguage: string;
  rule: MonitorRule;
  cooldownMinutes?: number;
  scheduleIntervalSec?: number;
}) {
  const name =
    input.name?.trim() ||
    `${input.rule.symbolName ?? input.rule.symbol ?? "监控"} · ${describeRule(input.rule).slice(0, 40)}`;

  const task = await prisma.task.create({
    data: {
      name,
      naturalLanguage: input.naturalLanguage,
      cooldownMinutes: input.cooldownMinutes ?? 30,
      scheduleIntervalSec: input.scheduleIntervalSec ?? 60,
      status: "ACTIVE",
      currentVersion: 1,
      versions: {
        create: {
          version: 1,
          ruleJson: JSON.stringify(input.rule),
          changeNote: "初始版本（自然语言解析）",
        },
      },
    },
    include: { versions: true },
  });

  return task;
}

export async function listTasks() {
  return prisma.task.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
      _count: { select: { alerts: true, executions: true } },
    },
  });
}

export async function getTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { version: "desc" } },
      executions: { orderBy: { createdAt: "desc" }, take: 50 },
      alerts: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
}

export async function updateTaskRule(
  id: string,
  rule: MonitorRule,
  changeNote?: string,
  extras?: { name?: string; cooldownMinutes?: number; scheduleIntervalSec?: number; naturalLanguage?: string },
) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw new Error("任务不存在");

  const nextVersion = task.currentVersion + 1;
  const updated = await prisma.task.update({
    where: { id },
    data: {
      currentVersion: nextVersion,
      name: extras?.name ?? task.name,
      cooldownMinutes: extras?.cooldownMinutes ?? task.cooldownMinutes,
      scheduleIntervalSec: extras?.scheduleIntervalSec ?? task.scheduleIntervalSec,
      naturalLanguage: extras?.naturalLanguage ?? task.naturalLanguage,
      // 规则变更后若处于降级且无强制暂停，保持可恢复
      versions: {
        create: {
          version: nextVersion,
          ruleJson: JSON.stringify(rule),
          changeNote: changeNote ?? `规则更新至 v${nextVersion}`,
        },
      },
    },
    include: { versions: { orderBy: { version: "desc" } } },
  });
  return updated;
}

export async function setTaskStatus(id: string, status: "ACTIVE" | "PAUSED" | "DEGRADED", reason?: string) {
  return prisma.task.update({
    where: { id },
    data: {
      status,
      degradedReason: status === "DEGRADED" ? reason ?? "数据异常降级" : null,
      lastError: status === "DEGRADED" ? reason : undefined,
    },
  });
}

export type RunTaskOptions = {
  force?: boolean;
  /** 跳过冷却检查（仍保留指纹去重），用于独立验证去重 */
  skipCooldown?: boolean;
  /** 注入评估上下文（隔离测试用）；缺省则走模拟行情 */
  evalContext?: EvalContext;
};

/**
 * 执行单个任务：真实调用规则引擎，处理去重、冷却、降级。
 * 优先级：暂停 → 引擎降级 → **指纹去重** → 冷却 → 新建预警
 */
export async function runTask(taskId: string, opts?: RunTaskOptions) {
  const started = Date.now();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  if (!task) throw new Error("任务不存在");

  if (task.status === "PAUSED" && !opts?.force) {
    const log = await prisma.executionLog.create({
      data: {
        taskId,
        ruleVersion: task.currentVersion,
        outcome: "SKIPPED",
        triggered: false,
        explanation: "任务已暂停，跳过本轮执行",
        skipReason: "PAUSED",
        durationMs: Date.now() - started,
      },
    });
    return { log, alert: null, skipped: true as const };
  }

  const version = task.versions[0];
  if (!version) throw new Error("缺少规则版本");

  const rule = JSON.parse(version.ruleJson) as MonitorRule;
  if (!opts?.evalContext) {
    await hydrateMarketState();
  }
  const ctx = opts?.evalContext ?? buildEvalContext(new Date());
  const evalResult = evaluateRule(taskId, rule, ctx);

  // 降级处理
  if (evalResult.degraded) {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "DEGRADED",
        degradedReason: evalResult.degradeReason,
        lastError: evalResult.degradeReason,
        lastRunAt: new Date(),
      },
    });
    const log = await prisma.executionLog.create({
      data: {
        taskId,
        ruleVersion: task.currentVersion,
        outcome: "DEGRADED",
        triggered: false,
        explanation: `${evalResult.explanation}｜${DATA_DISCLAIMER}`,
        marketSnapshot: JSON.stringify({ quotes: ctx.quotes, fault: ctx.dataFault }),
        skipReason: evalResult.degradeReason,
        durationMs: Date.now() - started,
      },
    });
    return { log, alert: null, skipped: false as const, degraded: true as const };
  }

  // 数据恢复：若之前 DEGRADED 且本轮正常，自动恢复 ACTIVE
  if (task.status === "DEGRADED") {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "ACTIVE", degradedReason: null, lastError: null },
    });
  }

  let alert = null;
  if (evalResult.triggered) {
    // 去重窗口至少 1 分钟，避免 cooldownMinutes=0 时窗口退化为 0
    const dedupWindowMs = Math.max(task.cooldownMinutes, 1) * 60 * 1000;
    const recent = await prisma.alert.findFirst({
      where: {
        taskId,
        fingerprint: evalResult.fingerprint,
        suppressed: false,
        createdAt: { gte: new Date(Date.now() - dedupWindowMs) },
      },
    });

    // ① 指纹去重优先于冷却（相同事件不产生第二条有效预警）
    if (recent && !opts?.force) {
      alert = await prisma.alert.create({
        data: {
          taskId,
          ruleVersion: task.currentVersion,
          fingerprint: evalResult.fingerprint,
          title: `[去重抑制] ${task.name}`,
          message: `与已有预警 ${recent.id} 指纹相同，已抑制。判定说明：${evalResult.explanation}`,
          severity: evalResult.severity,
          suppressed: true,
          suppressReason: "DEDUP_FINGERPRINT",
        },
      });
      const log = await prisma.executionLog.create({
        data: {
          taskId,
          ruleVersion: task.currentVersion,
          outcome: "SKIPPED",
          triggered: true,
          explanation: `触发条件满足，但指纹去重抑制：${evalResult.fingerprint}（关联预警 ${recent.id}）`,
          marketSnapshot: JSON.stringify({
            quotes: ctx.quotes,
            observed: evalResult.observed,
            disclaimer: DATA_DISCLAIMER,
          }),
          skipReason: "DEDUP",
          fingerprint: evalResult.fingerprint,
          durationMs: Date.now() - started,
        },
      });
      await prisma.task.update({
        where: { id: taskId },
        data: { lastRunAt: new Date(), status: "ACTIVE" },
      });
      return { log, alert, skipped: true as const, dedup: true as const };
    }

    // ② 冷却：不同指纹或无去重命中时，抑制时间窗内的重复有效预警
    if (task.lastAlertAt && !opts?.force && !opts?.skipCooldown) {
      const elapsedMin = (Date.now() - task.lastAlertAt.getTime()) / 60000;
      if (elapsedMin < task.cooldownMinutes) {
        const log = await prisma.executionLog.create({
          data: {
            taskId,
            ruleVersion: task.currentVersion,
            outcome: "SKIPPED",
            triggered: true,
            explanation: `规则已满足，但处于冷却期（剩余约 ${(task.cooldownMinutes - elapsedMin).toFixed(1)} 分钟），抑制重复预警`,
            marketSnapshot: JSON.stringify({
              quotes: ctx.quotes,
              summary: quoteSummary(ctx.quotes),
              disclaimer: DATA_DISCLAIMER,
            }),
            skipReason: "COOLDOWN",
            fingerprint: evalResult.fingerprint,
            durationMs: Date.now() - started,
          },
        });
        await prisma.task.update({
          where: { id: taskId },
          data: { lastRunAt: new Date(), status: "ACTIVE", degradedReason: null },
        });
        return { log, alert: null, skipped: true as const, cooldown: true as const };
      }
    }

    alert = await prisma.alert.create({
      data: {
        taskId,
        ruleVersion: task.currentVersion,
        fingerprint: evalResult.fingerprint,
        title: `预警：${task.name}`,
        message: `${evalResult.explanation}\n数据说明：${DATA_DISCLAIMER}`,
        severity: evalResult.severity,
        suppressed: false,
      },
    });
    await prisma.task.update({
      where: { id: taskId },
      data: { lastAlertAt: new Date(), lastRunAt: new Date(), status: "ACTIVE", degradedReason: null },
    });
  } else {
    await prisma.task.update({
      where: { id: taskId },
      data: { lastRunAt: new Date(), status: "ACTIVE", degradedReason: null },
    });
  }

  const log = await prisma.executionLog.create({
    data: {
      taskId,
      ruleVersion: task.currentVersion,
      outcome: evalResult.triggered ? "TRIGGERED" : "NOT_TRIGGERED",
      triggered: evalResult.triggered,
      explanation: evalResult.triggered
        ? evalResult.explanation
        : `未触发。原因：${evalResult.explanation}`,
      marketSnapshot: JSON.stringify({
        quotes: ctx.quotes,
        observed: evalResult.observed,
        summary: quoteSummary(ctx.quotes),
        disclaimer: DATA_DISCLAIMER,
      }),
      fingerprint: evalResult.fingerprint,
      durationMs: Date.now() - started,
    },
  });

  return { log, alert, skipped: false as const };
}

/**
 * 调度一轮：对所有 ACTIVE/DEGRADED 任务按间隔执行。
 * 使用 SystemMeta 简单锁防止重复并发调度。
 */
export async function runSchedulerTick() {
  const lockKey = "scheduler_lock";
  const now = Date.now();
  const existing = await prisma.systemMeta.findUnique({ where: { key: lockKey } });
  if (existing) {
    const lockedAt = Number(existing.value);
    if (Number.isFinite(lockedAt) && now - lockedAt < 15_000) {
      return { skipped: true as const, reason: "LOCK_HELD", results: [] as Awaited<ReturnType<typeof runTask>>[] };
    }
  }

  await prisma.systemMeta.upsert({
    where: { key: lockKey },
    create: { key: lockKey, value: String(now) },
    update: { value: String(now) },
  });

  try {
    const tasks = await prisma.task.findMany({
      where: { status: { in: ["ACTIVE", "DEGRADED"] } },
    });

    const results = [];
    for (const task of tasks) {
      const due =
        !task.lastRunAt ||
        Date.now() - task.lastRunAt.getTime() >= task.scheduleIntervalSec * 1000;
      if (!due) continue;
      try {
        results.push(await runTask(task.id));
      } catch (err) {
        await prisma.executionLog.create({
          data: {
            taskId: task.id,
            ruleVersion: task.currentVersion,
            outcome: "ERROR",
            triggered: false,
            explanation: `执行异常：${err instanceof Error ? err.message : String(err)}`,
            skipReason: "ERROR",
          },
        });
        await prisma.task.update({
          where: { id: task.id },
          data: {
            status: "DEGRADED",
            lastError: err instanceof Error ? err.message : String(err),
            degradedReason: "执行异常",
            lastRunAt: new Date(),
          },
        });
      }
    }

    await prisma.systemMeta.upsert({
      where: { key: "scheduler_last_tick" },
      create: { key: "scheduler_last_tick", value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    });

    return { skipped: false as const, reason: null, results };
  } finally {
    await prisma.systemMeta.deleteMany({ where: { key: lockKey } }).catch(() => undefined);
  }
}

export async function getDashboardStats() {
  const [taskCount, activeCount, pausedCount, degradedCount, alertCount, execCount] =
    await Promise.all([
      prisma.task.count(),
      prisma.task.count({ where: { status: "ACTIVE" } }),
      prisma.task.count({ where: { status: "PAUSED" } }),
      prisma.task.count({ where: { status: "DEGRADED" } }),
      prisma.alert.count({ where: { suppressed: false } }),
      prisma.executionLog.count(),
    ]);

  const recentAlerts = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { task: { select: { name: true } } },
  });

  const recentExecs = await prisma.executionLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { task: { select: { name: true } } },
  });

  return {
    taskCount,
    activeCount,
    pausedCount,
    degradedCount,
    alertCount,
    execCount,
    recentAlerts,
    recentExecs,
    dataDisclaimer: DATA_DISCLAIMER,
  };
}
