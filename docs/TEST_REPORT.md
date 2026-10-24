# 测试报告

本报告仅记录**实际执行过**的命令与结果。未运行项不会标记为通过。

## 1. 单元 / 逻辑测试

**命令：** `npm run test`

### 历史记录（开发期）

```
✓ tests/nl-parser.test.ts (3)
✓ tests/rule-engine.test.ts (4)
✓ tests/e2e-flow.test.ts (1)
Test Files  3 passed (3)
Tests  8 passed (8)
```

### 本轮更新（2026-10-24 · 提交材料整理）

补充 `rule-engine-extra`、`compliance-static` 后曾执行 **18** 项（见历史 `01-vitest-after-disclaimer.log`）。

### 再更新（2026-10-24 · 提交前专项修复）

新增条件类型 / A-05 / A-06 等后重新执行：

**命令：** `npm run test`  
**日志：** `submission/evidence/r2-01-vitest.utf8.txt`

```
Test Files  7 passed (7)
Tests  36 passed (36)
```

另：`dedup-evidence.json` 证明第二次抑制原因为 **DEDUP**（非 COOLDOWN）；`scheduler-verify.json` 证明调度鉴权与独立 worker。

## 2. TypeScript 类型检查

**命令：** `npm run typecheck`  
**本轮日志：** `submission/evidence/02-typecheck.log`  
**结果：** 通过（退出码 0）

## 3. ESLint

**命令：** `npm run lint`  
**本轮日志：** `submission/evidence/03-lint.log`  
**结果：** 通过（退出码 0）

## 4. 生产构建

**命令：** `npm run build`

- 首次（本轮）：失败，`EPERM` 重命名 Prisma query engine（进程占用）→ `submission/evidence/04-build.log`
- 释放占用后重试：**通过** → `submission/evidence/04-build-retry.log`

## 5. API 主链路冒烟

### 历史记录（开发期，正式库）

**命令：** `node scripts/smoke.mjs`（`npm run start` → http://localhost:3000）

| 步骤 | 实际输出 |
|------|----------|
| 解析 | `PARSE true 0.65` |
| 创建入库 | `CREATE … ACTIVE` |
| 触发预警 | `RUN1 TRIGGERED alert=true` |
| 冷却抑制 | `RUN2 SKIPPED COOLDOWN` |
| 暂停生效 | `RUN3 paused SKIPPED` |
| 规则升版 | `VERSION 2` |
| 超时降级 | `DEGRADE DEGRADED DEGRADED` |
| 恢复继续 | `RECOVER NOT_TRIGGERED ACTIVE` |

### 本轮更新（隔离库 + 3010 端口）

**命令：** `DATABASE_URL=…/isolated-smoke.db` 下 `next start -p 3010`，再 `BASE_URL=http://localhost:3010 node scripts/smoke.mjs`  
**日志：** `submission/evidence/06-smoke-isolated.log`  
**DB dump：** `submission/evidence/08-smoke-db-dump.json`  
**结果：** 退出码 0；主链路步骤与上表一致。

另有不经 HTTP 的隔离证据脚本：`scripts/isolated-evidence.mjs` → `submission/evidence/isolated-flow-evidence.json`。

## 6. 正式测试说明

评审用完整用例表见：

- `submission/02_测试说明与结果.md`
- `submission/03_关键数字与结论追溯.md`
- `submission/提交清单.md`

## 7. 已知限制

- 行情为 SIMULATED，非实盘
- 自然语言覆盖常见句式，复杂口语需人工改规则
- 开发模式（`next dev`）在极快连续编译时偶发 manifest 读失败，生产模式更稳
- 去重 `DEDUP` 跳过原因在冒烟中可能被冷却分支抢先；见提交测试说明 TC-M-08
- 公开 URL / GitHub / 演示视频仍待用户补齐
