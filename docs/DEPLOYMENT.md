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

**20**（优先级从高到低：`NODE_VERSION` 环境变量 → `.nvmrc` → `package.json` engines）。

Render Blueprint **没有** `nodeVersion` 字段；本仓库用 `NODE_VERSION=20` + `.nvmrc` 固定大版本。

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

Render 会注入 `PORT`。首次启动会自动执行 PostgreSQL `prisma migrate deploy`。

### 健康检查

路径：`/api/health`  
期望：HTTP 200 且 JSON `ok: true`、`db: "up"`

### 环境变量清单

| 变量 | 必需 | 说明 |
|------|------|------|
| `DATABASE_URL` | **是** | Render PostgreSQL 连接串（Blueprint 用 `fromDatabase` 自动注入） |
| `NODE_VERSION` | 建议 | `20` |
| `NEXT_PUBLIC_APP_NAME` | 否 | 默认 SignalWatch |
| `NEXT_PUBLIC_DATA_MODE` | 建议 | `SIMULATED` |
| `ENABLE_SERVER_SCHEDULER` | 建议 | `1` 启用进程内调度 |
| `SCHEDULER_INTERVAL_MS` | 否 | 默认 20000 |
| `SCHEDULER_SECRET` | **强烈建议** | 保护 `/api/scheduler/tick`；Blueprint 用 `generateValue`，**勿明文写入仓库** |
| `DEMO_MARKET_SEED_JSON` | 否 | 可选演示覆盖；通常靠 DB 持久化 |

### 数据库迁移步骤

1. 使用 Blueprint 时：`render.yaml` 会同时创建免费 Web Service 与免费 PostgreSQL，并把 `DATABASE_URL` 注入到 Web Service。
2. 手动创建时：先建 PostgreSQL，再在 Web Service 环境变量中绑定 Internal Database URL。
3. 部署时 `start:render` 会执行 `prisma migrate deploy --schema=prisma-postgres/schema.prisma`。
4. 表：Task / RuleVersion / ExecutionLog / Alert / SystemMeta。

### 当前已部署实例（正式演示）

| 项 | 值 |
|----|-----|
| Web | https://signalwatch-sfkf.onrender.com |
| Health | https://signalwatch-sfkf.onrender.com/api/health |
| 数据库 | Render PostgreSQL（Blueprint 注入 `DATABASE_URL`，**勿写入仓库**） |
| 业务代码基准 | `233d09d715deb06c5a2ec70b7141f107a741ea16` |

公网连通性以健康检查与 `/api/stats` 快照为准（见 `submission/evidence/r3-05` / `r3-06`）。本机无需也不应提交真实连接串。

### Blueprint

根目录 `render.yaml` 可用于 Dashboard → New → Blueprint。勿写入真实密码。

使用 Blueprint 时，一般**不必**再手动单独创建 PostgreSQL（YAML 已声明 `signalwatch-db`）。若你选择「只建 Web Service」的手动流程，才需要另行创建数据库并绑定 `DATABASE_URL`。

### 免费套餐限制（务必知晓）

| 资源 | 限制 |
|------|------|
| Free Web Service | 约 **15 分钟无流量后休眠**；下次访问需约 1 分钟冷启动；本地文件系统不持久 |
| Free PostgreSQL | 约 **30 天后到期**；到期后有约 14 天宽限期，未升级将被删除；容量约 1 GB；每个 workspace **仅 1 个**免费库 |
| 共用额度 | 每月有免费实例小时 / 出站带宽 / 构建分钟上限（见 Render Billing） |
| 进程内调度 | 实例休眠期间**不能保证**持续执行；公开演示环境非生产级多用户隔离 |

演示考核可接受休眠与冷启动；长期演示建议升级或定期续期数据库。

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
| Render 单实例 `ENABLE_SERVER_SCHEDULER=1` | 当前演示已启用（休眠时中断） |
| 外部 cron + SECRET | 可另行配置；本演示**未单独启用**外部 cron |
| 多实例分布式锁 | 未实现（免费单实例足够演示） |

---

## 生产构建（本地 SQLite）

```bash
# .env 保持 file:./dev.db
npm run typecheck
npm run lint
npm run test
npm run build
```

本地构建通过**不等于**替代公网健康检查；云端以 `/api/health` 为准。
