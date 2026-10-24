# SignalWatch · 智能投资监控与风险雷达

把自然语言关注点变成可长期运行的监控任务，并清楚说明「为何触发 / 为何未触发」。

## 目标用户

- 需要持续盯盘但无法时刻在线的个人投资者
- 希望把口头关注点沉淀为可检查规则的投研助理
- 需要任务状态、降级与恢复可解释的产品/风控演示场景

## 核心能力

1. **自然语言 → 结构化规则**：确定性中文解析器，结果可编辑、可保存
2. **统一任务模型**：价格 / 涨跌幅 / 热度 / 事件 / 日历 / 组合条件
3. **真实调度与规则引擎**：定时执行、立即执行、暂停/恢复
4. **去重与冷却**：指纹去重 + 冷却窗口抑制重复预警
5. **版本管理**：每次改规则生成新版本，历史可追溯
6. **异常降级与恢复**：超时 / 过期 / 冲突时降级解释，数据恢复后自动继续
7. **执行日志**：每轮执行写入数据库，含行情快照与说明

## 技术栈

- Next.js 15（App Router）+ TypeScript + Tailwind CSS
- Prisma + SQLite（本地持久化）
- Vitest 单元 / 逻辑端到端测试

## 快速开始

```bash
cd signalwatch
npm install --legacy-peer-deps
npx prisma migrate dev --schema=prisma/schema.prisma
npm run dev
```

浏览器打开：[http://localhost:3000](http://localhost:3000)

本地默认 **SQLite**（`prisma/dev.db`）。公网部署使用 **PostgreSQL**（`prisma-postgres/`），由 `DATABASE_URL` 自动切换。详见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

**尚未推送 GitHub / 尚未部署 Render**（按当前约定先只做适配）。

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务 |
| `npm run build` | 正式构建 |
| `npm run start` | 生产模式启动 |
| `npm run lint` | ESLint 检查 |
| `npm run test` | 单元与逻辑测试 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npx prisma studio` | 可视化查看数据库 |

## AI 角色说明

本项目的「自然语言解析」采用**确定性规则解析器**（非在线大模型调用），以保证：

- 结果可复现、可单测
- 无外部 API Key 依赖
- 解析失败时给出可操作提示，并允许人工编辑 JSON 规则

开发过程中可使用 AI 辅助写代码与文档，详见 `docs/AI_USAGE.md`。

## 数据使用

默认使用 **SIMULATED 模拟行情/事件/日历**，界面与 API 均明确标注。  
详见 `docs/DATA_SOURCES.md`。  
若接入扶摇 / iFinD，可替换 `src/lib/market-data.ts`，规则引擎无需改动。

## 已知边界与未做事项

- 未对接真实券商/行情实盘接口（需账号与合规授权）
- 未实现推送渠道（邮件/企微/短信），预警落库可见
- 自然语言覆盖常见中文句式，复杂口语可能需人工改规则
- 单机 SQLite，未做多租户与水平扩展
- 公开部署需自行配置托管平台与环境变量

## 文档索引

- [架构说明](docs/ARCHITECTURE.md)
- [测试报告](docs/TEST_REPORT.md)
- [AI 使用与验证](docs/AI_USAGE.md)
- [数据来源](docs/DATA_SOURCES.md)
- [部署说明](docs/DEPLOYMENT.md)
- [演示脚本](docs/VIDEO_SCRIPT.md)
- [录屏前人工检查清单](docs/DEMO_CHECKLIST.md)

## 正式提交材料（submission）

| 文件 | 说明 |
|------|------|
| [submission/01_AI使用与验证记录.md](submission/01_AI使用与验证记录.md) | AI 角色、边界与验证 |
| [submission/02_测试说明与结果.md](submission/02_测试说明与结果.md) | 主链路 / 异常 / 合规用例 |
| [submission/03_关键数字与结论追溯.md](submission/03_关键数字与结论追溯.md) | 数字可追溯表 |
| [submission/提交清单.md](submission/提交清单.md) | 齐备度核对 |
| [submission/evidence/](submission/evidence/) | 本轮真实命令日志与隔离库证据 |

本轮实测摘要（2026-10-24 修复后）：Vitest **36** 通过；独立去重证据为 `DEDUP`；本地服务端/worker 调度已验证（线上 cron 未启用）；typecheck/lint/build 通过。  
公开 Web URL、GitHub 仓库、60–180 秒演示视频：**待用户补齐**（详见 `submission/提交清单.md`）。

### 长期调度（不依赖浏览器）

```bash
# 方式 A：Next 进程内
ENABLE_SERVER_SCHEDULER=1 SCHEDULER_SECRET=your-secret npm run start

# 方式 B：外部 worker
SCHEDULER_SECRET=your-secret BASE_URL=http://localhost:3000 npm run scheduler:worker
```

仅打开网页时的 `SchedulerPing` 在关闭浏览器后会停止。

## 合规提示

本产品为技术演示，不构成投资建议。模拟数据不得被表述为实时行情。
