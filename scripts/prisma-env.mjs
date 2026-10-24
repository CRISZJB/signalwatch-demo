/**
 * 根据 DATABASE_URL 选择 Prisma schema：
 * - postgres/postgresql → prisma-postgres/schema.prisma
 * - 其他（含 file: SQLite）→ prisma/schema.prisma
 *
 * 用法：
 *   node scripts/prisma-env.mjs generate
 *   node scripts/prisma-env.mjs migrate
 *   node scripts/prisma-env.mjs print
 */
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const url = process.env.DATABASE_URL || "";
const isPostgres = /^postgres(ql)?:\/\//i.test(url);
const schema = isPostgres
  ? join(root, "prisma-postgres", "schema.prisma")
  : join(root, "prisma", "schema.prisma");

const action = process.argv[2] || "print";

if (action === "print") {
  console.log(
    JSON.stringify(
      {
        provider: isPostgres ? "postgresql" : "sqlite",
        schema: schema.replace(/\\/g, "/"),
        hasDatabaseUrl: Boolean(url),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const args =
  action === "generate"
    ? ["prisma", "generate", "--schema", schema]
    : action === "migrate"
      ? ["prisma", "migrate", "deploy", "--schema", schema]
      : null;

if (!args) {
  console.error(`未知动作: ${action}（generate | migrate | print）`);
  process.exit(1);
}

if (action === "migrate" && !isPostgres && !url.startsWith("file:")) {
  console.warn("[prisma-env] 非 postgres URL 上执行 migrate deploy，使用本地 sqlite schema");
}

console.log(`[prisma-env] ${action} schema=${schema}`);
const result = spawnSync("npx", args, {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
