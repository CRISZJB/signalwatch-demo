/**
 * 第二轮修复后证据采集（隔离库，不 reset 正式库）
 */
import { spawnSync } from "child_process";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const evidenceDir = join(root, "submission", "evidence");
mkdirSync(evidenceDir, { recursive: true });

function run(name, command, args, envExtra = {}) {
  const logFile = join(evidenceDir, `${name}.log`);
  const started = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...envExtra },
    encoding: "utf8",
    shell: true,
    maxBuffer: 30 * 1024 * 1024,
  });
  const body = [
    `===== ${name} =====`,
    `started: ${started}`,
    `finished: ${new Date().toISOString()}`,
    `command: ${command} ${args.join(" ")}`,
    `exitCode: ${result.status}`,
    "----- stdout -----",
    result.stdout || "",
    "----- stderr -----",
    result.stderr || "",
  ].join("\n");
  writeFileSync(logFile, body, "utf8");
  // 同步可读 UTF-8 副本
  writeFileSync(join(evidenceDir, `${name}.utf8.txt`), body, "utf8");
  console.log(`[${result.status === 0 ? "OK" : "FAIL"}] ${name} exit=${result.status}`);
  return { name, exitCode: result.status, ok: result.status === 0, logFile: `submission/evidence/${name}.log` };
}

const summary = [];
summary.push(run("r2-01-vitest", "npm", ["run", "test"]));
summary.push(run("r2-02-typecheck", "npm", ["run", "typecheck"]));
summary.push(run("r2-03-lint", "npm", ["run", "lint"]));
summary.push(run("r2-04-build", "npm", ["run", "build"]));
summary.push(run("r2-05-dedup", "node", ["--import", "tsx", "scripts/dedup-evidence.mjs"]));
summary.push(
  run("r2-06-isolated-flow", "node", ["--import", "tsx", "scripts/isolated-evidence.mjs"]),
);

// 规范化已有 JSON 证据为 UTF-8（重写）
for (const f of readdirSync(evidenceDir)) {
  if (!f.endsWith(".json") && !f.endsWith(".jsonl")) continue;
  const p = join(evidenceDir, f);
  try {
    const raw = readFileSync(p, "utf8");
    JSON.parse(raw);
    writeFileSync(p, raw.replace(/^\uFEFF/, ""), "utf8");
  } catch {
    /* skip invalid */
  }
}

const index = {
  generatedAt: new Date().toISOString(),
  round: "fix-before-submit-r2",
  encoding: "UTF-8",
  note: "正式 prisma/dev.db 未 reset。脱敏：未包含密钥明文。",
  commands: summary,
  keyEvidence: {
    dedup: existsSync(join(evidenceDir, "dedup-evidence.json"))
      ? "submission/evidence/dedup-evidence.json"
      : null,
    isolatedFlow: "submission/evidence/isolated-flow-evidence.json",
    vitest: "submission/evidence/r2-01-vitest.utf8.txt",
  },
  privacy: "日志中的本机绝对路径保留为可复现需要；无 API Key。",
};

writeFileSync(join(evidenceDir, "run-summary.json"), JSON.stringify(index, null, 2), "utf8");
writeFileSync(join(evidenceDir, "EVIDENCE_INDEX.md"), `# 证据索引（UTF-8）

生成时间：${index.generatedAt}

| 文件 | 说明 |
|------|------|
| r2-01-vitest.log / .utf8.txt | 单元测试 |
| r2-02-typecheck.* | 类型检查 |
| r2-03-lint.* | 规范检查 |
| r2-04-build.* | 生产构建 |
| r2-05-dedup.* + dedup-evidence.json | 独立去重 |
| r2-06-isolated-flow.* + isolated-flow-evidence.json | 隔离主链路 |
| run-summary.json | 本轮汇总 |

编码说明：所有 .utf8.txt 与 .json 以 UTF-8 无 BOM 写入。
`, "utf8");

const failed = summary.filter((s) => !s.ok);
process.exit(failed.length ? 1 : 0);
