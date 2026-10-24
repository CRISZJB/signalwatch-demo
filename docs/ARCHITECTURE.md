# 架构说明

## 总览

```
自然语言输入
    ↓
NL Parser（确定性解析）
    ↓
可编辑 MonitorRule JSON
    ↓
Task + RuleVersion（SQLite）
    ↓
Scheduler Tick / 手动 Run
    ↓
Market Data（SIMULATED）→ Rule Engine
    ↓
ExecutionLog + Alert（去重/冷却/降级）
    ↓
Web 总览 / 任务详情 / 预警中心
```

## 模块

| 模块 | 路径 | 职责 |
|------|------|------|
| NL 解析 | `src/lib/nl-parser.ts` | 中文关注点 → 结构化条件 |
| 规则引擎 | `src/lib/rule-engine.ts` | 条件判定、指纹、降级 |
| 行情源 | `src/lib/market-data.ts` | 模拟报价/事件/日历/故障注入 |
| 任务服务 | `src/lib/task-service.ts` | CRUD、执行、调度锁、统计 |
| API | `src/app/api/**` | REST 接口 |
| UI | `src/app/**` | 中文操作界面 |
| 调度心跳 | `src/components/SchedulerPing.tsx` | 前端定时触发 `/api/scheduler/tick` |

## 数据模型

- **Task**：监控任务状态（ACTIVE / PAUSED / DEGRADED）
- **RuleVersion**：规则版本快照
- **ExecutionLog**：每轮执行结果与解释
- **Alert**：预警及抑制原因
- **SystemMeta**：调度锁等元数据

## 可靠性设计

1. **调度锁**：`scheduler_lock` 防止 15 秒内重复并发调度
2. **去重**：同任务同 fingerprint 在冷却窗内抑制
3. **冷却**：`lastAlertAt + cooldownMinutes` 抑制重复有效预警
4. **降级**：timeout / stale / conflict → DEGRADED + 解释，不误报
5. **恢复**：数据正常后下一轮自动回到 ACTIVE
6. **暂停**：PAUSED 任务跳过执行并记 SKIPPED 日志
7. **版本**：每次改规则 `currentVersion + 1` 并写入 RuleVersion

## 关键数字可追溯性

- 总览统计来自 Prisma `count` 查询
- 预警文案附带引擎解释与数据声明
- 执行日志保存 `marketSnapshot` JSON
