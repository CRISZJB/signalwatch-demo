/**
 * 本轮正式证据采集：将命令输出写入 submission/evidence
 * 不重置正式数据库；隔离链路写入独立 sqlite。
 */
import { spawnSync } from "child_process";
import { mkdirSync, writeFileSync, appendFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const evidenceDir = join(root, "submission", "evidence");
mkdirSync(evidenceDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const summary = [];

function run(name, command, args, envExtra = {}) {
  const logFile = join(evidenceDir, `${name}.log`);
  const started = new Date().toISOString();
  const header = `\n===== ${name} =====\nstarted: ${started}\ncommand: ${command} ${args.join(" ")}\n`;
  writeFileSync(logFile, header, "utf8");

  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...envExtra },
    encoding: "utf8",
    shell: true,
    maxBuffer: 20 * 1024 * 1024,
  });

  const body = [
    `exitCode: ${result.status}`,
    "----- stdout -----",
    result.stdout || "",
    "----- stderr -----",
    result.stderr || "",
  ].join("\n");
  appendFileSync(logFile, body, "utf8");

  const item = {
    name,
    started,
    finished: new Date().toISOString(),
    exitCode: result.status,
    logFile: `submission/evidence/${name}.log`,
    ok: result.status === 0,
  };
  summary.push(item);
  console.log(`[${item.ok ? "OK" : "FAIL"}] ${name} exit=${result.status}`);
  return item;
}

// 1) unit tests
run("01-vitest", "npm", ["run", "test"]);
// 2) typecheck
run("02-typecheck", "npm", ["run", "typecheck"]);
// 3) lint
run("03-lint", "npm", ["run", "lint"]);
// 4) build (may take time)
run("04-build", "npm", ["run", "build"]);
// 5) isolated evidence (tsx)
run("05-isolated-flow", "node", ["--import", "tsx", "scripts/isolated-evidence.mjs"]);

const meta = {
  collectedAt: new Date().toISOString(),
  stamp,
  summary,
  note: "正式 prisma/dev.db 未被 migrate reset；隔离证据使用 isolated-submission.db",
};
writeFileSync(join(evidenceDir, "run-summary.json"), JSON.stringify(meta, null, 2), "utf8");
console.log("Summary written to submission/evidence/run-summary.json");

const failed = summary.filter((s) => !s.ok);
process.exit(failed.length ? 1 : 0);
