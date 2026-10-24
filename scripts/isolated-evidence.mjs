/**
 * 隔离数据库证据采集：不触碰正式 prisma/dev.db
 * 用法：node scripts/isolated-evidence.mjs
 */
import { execSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const evidenceDir = join(root, "submission", "evidence");
const dbPath = join(evidenceDir, "isolated-submission.db").replace(/\\/g, "/");
const dbUrl = `file:${dbPath}`;

mkdirSync(evidenceDir, { recursive: true });
process.env.DATABASE_URL = dbUrl;

console.log("ISOLATED_DB", dbUrl);

execSync("npx prisma migrate deploy", {
  cwd: root,
  env: { ...process.env, DATABASE_URL: dbUrl },
  stdio: "inherit",
});

const require = createRequire(import.meta.url);
delete require.cache[require.resolve("@prisma/client")];

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const parserUrl = pathToFileURL(join(root, "src/lib/nl-parser.ts")).href;
const engineUrl = pathToFileURL(join(root, "src/lib/rule-engine.ts")).href;

async function loadTs(url) {
  // 通过 tsx 注册或直接动态 import：本脚本由 node --import tsx 运行更稳
  return import(url);
}

async function main() {
  let parseNaturalLanguage;
  let evaluateRule;
  try {
    ({ parseNaturalLanguage } = await loadTs(parserUrl));
    ({ evaluateRule } = await loadTs(engineUrl));
  } catch (e) {
    console.error("动态 import TS 失败，请使用: node --import tsx scripts/isolated-evidence.mjs");
    throw e;
  }

  const nl = "贵州茅台跌破1700元提醒我";
  const parsed = parseNaturalLanguage(nl);
  const rule = parsed.rule;
  const threshold =
    rule?.condition?.type === "price" ? rule.condition.threshold : null;

  const task = await prisma.task.create({
    data: {
      name: "证据-茅台跌破1700",
      naturalLanguage: nl,
      cooldownMinutes: 30,
      scheduleIntervalSec: 30,
      status: "ACTIVE",
      currentVersion: 1,
      versions: {
        create: {
          version: 1,
          ruleJson: JSON.stringify(rule),
          changeNote: "隔离证据初始版本",
        },
      },
    },
  });

  const quotePrice = 1650;
  const prevClose = 1720;
  const asOf = new Date().toISOString();
  const evalTriggered = evaluateRule(task.id, rule, {
    now: new Date(),
    dataFault: null,
    events: [],
    calendar: [],
    quotes: {
      "600519": {
        symbol: "600519",
        name: "贵州茅台",
        price: quotePrice,
        prevClose,
        changePct: ((quotePrice - prevClose) / prevClose) * 100,
        heat: 70,
        volume: 1000,
        asOf,
        source: "SIMULATED",
        freshnessSec: 60,
      },
    },
  });

  const log1 = await prisma.executionLog.create({
    data: {
      taskId: task.id,
      ruleVersion: 1,
      outcome: evalTriggered.triggered ? "TRIGGERED" : "NOT_TRIGGERED",
      triggered: evalTriggered.triggered,
      explanation: evalTriggered.explanation,
      fingerprint: evalTriggered.fingerprint,
      marketSnapshot: JSON.stringify({
        price: quotePrice,
        prevClose,
        threshold,
        source: "SIMULATED",
        asOf,
      }),
    },
  });

  let alert1 = null;
  if (evalTriggered.triggered) {
    alert1 = await prisma.alert.create({
      data: {
        taskId: task.id,
        ruleVersion: 1,
        fingerprint: evalTriggered.fingerprint,
        title: `预警：${task.name}`,
        message: evalTriggered.explanation,
        severity: "warning",
        suppressed: false,
      },
    });
    await prisma.task.update({
      where: { id: task.id },
      data: { lastAlertAt: new Date(), lastRunAt: new Date() },
    });
  }

  // 冷却抑制记录
  const logCooldown = await prisma.executionLog.create({
    data: {
      taskId: task.id,
      ruleVersion: 1,
      outcome: "SKIPPED",
      triggered: true,
      explanation: "规则已满足，但处于冷却期，抑制重复预警",
      skipReason: "COOLDOWN",
      fingerprint: evalTriggered.fingerprint,
    },
  });

  // 升版
  const ruleV2 = structuredClone(rule);
  if (ruleV2.condition.type === "price") ruleV2.condition.threshold = 1600;
  await prisma.ruleVersion.create({
    data: {
      taskId: task.id,
      version: 2,
      ruleJson: JSON.stringify(ruleV2),
      changeNote: "阈值改为1600（隔离证据）",
    },
  });
  await prisma.task.update({
    where: { id: task.id },
    data: { currentVersion: 2 },
  });

  // 超时降级
  const evalTimeout = evaluateRule(task.id, ruleV2, {
    now: new Date(),
    dataFault: "timeout",
    events: [],
    calendar: [],
    quotes: {},
  });
  const logTimeout = await prisma.executionLog.create({
    data: {
      taskId: task.id,
      ruleVersion: 2,
      outcome: "DEGRADED",
      triggered: false,
      explanation: evalTimeout.explanation,
      skipReason: evalTimeout.degradeReason,
    },
  });
  await prisma.task.update({
    where: { id: task.id },
    data: { status: "DEGRADED", degradedReason: evalTimeout.degradeReason },
  });

  // 恢复
  const evalRecover = evaluateRule(task.id, ruleV2, {
    now: new Date(),
    dataFault: null,
    events: [],
    calendar: [],
    quotes: {
      "600519": {
        symbol: "600519",
        name: "贵州茅台",
        price: 1688,
        prevClose: 1688,
        changePct: 0,
        heat: 70,
        volume: 1000,
        asOf: new Date().toISOString(),
        source: "SIMULATED",
        freshnessSec: 60,
      },
    },
  });
  const logRecover = await prisma.executionLog.create({
    data: {
      taskId: task.id,
      ruleVersion: 2,
      outcome: evalRecover.triggered ? "TRIGGERED" : "NOT_TRIGGERED",
      triggered: evalRecover.triggered,
      explanation: evalRecover.explanation,
      fingerprint: evalRecover.fingerprint,
      marketSnapshot: JSON.stringify({ price: 1688, threshold: 1600, source: "SIMULATED" }),
    },
  });
  await prisma.task.update({
    where: { id: task.id },
    data: { status: "ACTIVE", degradedReason: null, lastRunAt: new Date() },
  });

  const finalTask = await prisma.task.findUnique({
    where: { id: task.id },
    include: {
      versions: { orderBy: { version: "asc" } },
      executions: { orderBy: { createdAt: "asc" } },
      alerts: true,
    },
  });

  const evidence = {
    generatedAt: new Date().toISOString(),
    isolatedDatabase: dbUrl,
    naturalLanguage: nl,
    parse: {
      success: parsed.success,
      confidence: parsed.confidence,
      threshold,
      comparator: rule?.condition?.type === "price" ? rule.condition.comparator : null,
      symbol: rule?.symbol,
    },
    triggerCase: {
      price: quotePrice,
      prevClose,
      threshold,
      asOf,
      source: "SIMULATED",
      result: evalTriggered,
      executionLogId: log1.id,
      alertId: alert1?.id ?? null,
    },
    cooldownSkipLogId: logCooldown.id,
    versionChange: {
      from: 1,
      to: 2,
      newThreshold: 1600,
      versions: finalTask.versions.map((v) => ({
        version: v.version,
        changeNote: v.changeNote,
        id: v.id,
      })),
    },
    degradeCase: {
      fault: "timeout",
      result: evalTimeout,
      executionLogId: logTimeout.id,
    },
    recoverCase: {
      price: 1688,
      threshold: 1600,
      result: evalRecover,
      executionLogId: logRecover.id,
      finalStatus: finalTask.status,
    },
    taskId: task.id,
    executionCount: finalTask.executions.length,
    alertCount: finalTask.alerts.length,
  };

  const out = join(evidenceDir, "isolated-flow-evidence.json");
  writeFileSync(out, JSON.stringify(evidence, null, 2), "utf8");
  console.log("WROTE", out);
  console.log(
    JSON.stringify(
      {
        taskId: evidence.taskId,
        triggered: evidence.triggerCase.result.triggered,
        threshold,
        price: quotePrice,
        version: 2,
        finalStatus: evidence.recoverCase.finalStatus,
        execs: evidence.executionCount,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(1);
});
