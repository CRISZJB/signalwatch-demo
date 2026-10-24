# 部署说明

## 本地运行（SQLite，保持不变）

```bash
cd signalwatch
npm install --legacy-peer-deps
cp .env.example .env
# DATABASE_URL="file:./dev.db"
npx prisma migrate dev --schema=prisma/schema.prisma
npm run dev
```

访问：http://localhost:3000

本地 SQLite 文件与 `prisma/migrations` **保留**，不会被 PostgreSQL 迁移覆盖或删除。

---

## 双数据库策略

| 环境 | Schema | 说明 |
|------|--------|------|
| 本地 | `prisma/schema.prisma`（sqlite） | 原有 `dev.db` 继续可用 |
| Render 等公网 | `prisma-postgres/schema.prisma` | 由 `DATABASE_URL=postgresql://...` 自动选择 |

选择逻辑：`scripts/prisma-env.mjs`（`postgres` 前缀 → postgres schema）。

```bash
npm run db:print          # 查看当前将使用的 provider/schema
npm run db:generate       # 按 DATABASE_URL 生成 Client
npm run db:migrate:postgres  # 仅在有 Postgres URL 时部署迁移
```

---

## Render Web Service（推荐手动或 Blueprint）

### Node 版本

**20**（见 `.nvmrc` / `package.json` engines）

### 依赖安装

```bash
npm install --legacy-peer-deps
```

### 生产构建命令（准确）

```bash
npm run build:render
```

等价于：

```bash
node scripts/prisma-env.mjs generate && next build
```

（构建机需已配置 `DATABASE_URL` 为 PostgreSQL，以便生成正确的 Prisma Client。）

### 启动命令（准确）

```bash
npm run start:render
```

等价于：

```bash
node scripts/prisma-env.mjs migrate && next start -p ${PORT:-3000}
```

Render 会注入 `PORT`。

### 健康检查

路径：`/api/health`  
期望：HTTP 200 且 JSON `ok: true`、`db: "up"`

### 环境变量清单

| 变量 | 必需 | 说明 |
|------|------|------|
| `DATABASE_URL` | **是** | Render PostgreSQL 连接串（含 ssl） |
| `NEXT_PUBLIC_APP_NAME` | 否 | 默认 SignalWatch |
| `NEXT_PUBLIC_DATA_MODE` | 建议 | `SIMULATED` |
| `ENABLE_SERVER_SCHEDULER` | 建议 | `1` 启用进程内调度 |
| `SCHEDULER_INTERVAL_MS` | 否 | 默认 20000 |
| `SCHEDULER_SECRET` | **强烈建议** | 保护 `/api/scheduler/tick` |
| `DEMO_MARKET_SEED_JSON` | 否 | 可选演示覆盖；通常靠 DB 持久化 |

### 数据库迁移步骤

1. 在 Render 创建 PostgreSQL，将连接串设为 Web Service 的 `DATABASE_URL`。
2. 部署时 `start:render` 会执行 `prisma migrate deploy --schema=prisma-postgres/schema.prisma`。
3. 表：Task / RuleVersion / ExecutionLog / Alert / SystemMeta。

**尚未拿到真实连接串前，无法在本机对云库做连通性测试。**

### Blueprint

可选参考根目录 `render.yaml`（勿写入真实密码）。

---

## 模拟行情在重启后

- `fault` / `overrides` 写入 `SystemMeta.market_demo_state`，进程重启后 `hydrateMarketState()` 恢复。
- 基准价表仍在代码内（可复现）。
- 可选 `DEMO_MARKET_SEED_JSON` 作为额外种子。

---

## 调度（公网）

| 层级 | 状态 |
|------|------|
| 调度 API | 已实现 |
| Render 单实例 `ENABLE_SERVER_SCHEDULER=1` | 可启用 |
| 外部 cron + SECRET | 可另行配置 |
| 多实例分布式锁 | 未实现（免费单实例足够演示） |

---

## 生产构建（本地无 Postgres 时）

使用本地 SQLite URL 即可验证 Next 构建：

```bash
# .env 保持 file:./dev.db
npm run typecheck
npm run lint
npm run test
npm run build
```

这**不**等于云端 PostgreSQL 已验证。
