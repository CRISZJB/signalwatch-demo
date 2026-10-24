/**
 * 独立去重证据：冷却与去重隔离验证
 * - cooldownMinutes 设为较大值（若去重优先，第二次应为 DEDUP 而非 COOLDOWN）
 * - 使用隔离数据库，不触碰正式库
 */
import { execSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const evidenceDir = join(root, "submission", "evidence");
mkdirSync(evidenceDir, { recursive: true });

const dbPath = join(evidenceDir, "isolated-dedup.db").replace(/\\/g, "/");
const dbUrl = `file:${dbPath}`;
process.env.DATABASE_URL = dbUrl;

execSync("npx prisma migrate deploy", {
  cwd: root,
  env: { ...process.env, DATABASE_URL: dbUrl },
  stdio: "inherit",
});

const require = createRequire(import.meta.url);
delete require.cache[require.resolve("@prisma/client")];
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const { createTask, runTask } = await import(pathToFileURL(join(root, "src/lib/task-service.ts")).href);

const rule = {
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

const ctx = {
  now: new Date(),
  dataFault: null,
  events: [],
  calendar: [],
  quotes: {
    "600519": {
      symbol: "600519",
      name: "贵州茅台",
      price: 1650,
      prevClose: 1720,
      changePct: -4.07,
      heat: 70,
      volume: 1,
      asOf: new Date().toISOString(),
      source: "SIMULATED",
      freshnessSec: 60,
    },
  },
};

const task = await createTask({
  name: "去重专项-茅台",
  naturalLanguage: "贵州茅台跌破1700",
  rule,
  cooldownMinutes: 30,
  scheduleIntervalSec: 60,
});

const run1 = await runTask(task.id, { evalContext: ctx });
const run2 = await runTask(task.id, { evalContext: ctx });

const alerts = await prisma.alert.findMany({ where: { taskId: task.id }, orderBy: { createdAt: "asc" } });
const validAlerts = alerts.filter((a) => !a.suppressed);
const suppressed = alerts.filter((a) => a.suppressed);

const evidence = {
  generatedAt: new Date().toISOString(),
  isolatedDatabase: dbUrl,
  note: "去重优先于冷却：第二次 skipReason 必须为 DEDUP，不能是 COOLDOWN",
  taskId: task.id,
  cooldownMinutes: 30,
  run1: {
    outcome: run1.log.outcome,
    skipReason: run1.log.skipReason,
    triggered: run1.log.triggered,
    fingerprint: run1.log.fingerprint,
    alertId: run1.alert?.id ?? null,
    alertSuppressed: run1.alert?.suppressed ?? null,
  },
  run2: {
    outcome: run2.log.outcome,
    skipReason: run2.log.skipReason,
    triggered: run2.log.triggered,
    fingerprint: run2.log.fingerprint,
    alertId: run2.alert?.id ?? null,
    alertSuppressed: run2.alert?.suppressed ?? null,
    suppressReason: run2.alert?.suppressReason ?? null,
  },
  validAlertCount: validAlerts.length,
  suppressedAlertCount: suppressed.length,
  pass:
    run1.log.outcome === "TRIGGERED" &&
    run2.log.skipReason === "DEDUP" &&
    validAlerts.length === 1 &&
    suppressed.length >= 1,
};

writeFileSync(join(evidenceDir, "dedup-evidence.json"), JSON.stringify(evidence, null, 2), "utf8");
console.log(JSON.stringify(evidence, null, 2));
await prisma.$disconnect();
process.exit(evidence.pass ? 0 : 1);
