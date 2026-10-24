# 证据索引（UTF-8）

> 最终整理：2026-10-25  
> 业务代码基准：`233d09d715deb06c5a2ec70b7141f107a741ea16`

## 编码与安全

- 正式可读日志为 **UTF-8**（无 BOM，空字节为 0）。  
- **未包含** API Key、数据库密码、`SCHEDULER_SECRET`、连接串。  
- 公网 JSON 为公开接口快照；计数为瞬时值，须带时间戳。

## 编码事故与修复（重要）

| 阶段 | 说明 |
|------|------|
| 问题 | `r3-0x-*.utf8.txt` / `.log` 曾由 PowerShell `Tee-Object` 写成 **UTF-16 LE**，却按 UTF-8 命名，含大量 `0x00` |
| 留存 | `r3-0x-*.CORRUPT-utf16le.legacy.bin`（损坏字节原文，可追溯） |
| 修复 | 2026-10-25 用 Node `spawnSync` 重跑命令，写入真 UTF-8：`r4-0x-*.utf8.txt`；并回填可读内容到 `r3-0x-*.utf8.txt`（文首有 REPAIRED 说明） |

## 本轮权威日志（r4 · 2026-10-25）

| 文件 | 说明 |
|------|------|
| `r4-01-vitest.log` / `.utf8.txt` | `npm run test` → **45 passed**，exit 0 |
| `r4-02-typecheck.*` | `npm run typecheck` → exit 0 |
| `r4-03-lint.*` | `npm run lint` → exit 0 |
| `r4-04-build.*` | `npm run build` → exit 0 |
| `r4-run-summary.json` | 退出码、字节检查、空字节检查 |

## 公网只读快照（r3 抓取，保留）

| 文件 | 说明 |
|------|------|
| `r3-05-public-health.json` | `/api/health` |
| `r3-06-public-stats.json` | `/api/stats` 完整快照 |
| `r3-06-public-stats.summary.json` | 脱敏摘要（含 DEDUP 样本） |
| `r3-run-summary.json` | 当时汇总指针 |

## 本地隔离 / 专项证据（JSON 文本，正式包收录）

| 文件 | 说明 |
|------|------|
| `dedup-evidence.json` | 独立去重：`skipReason=DEDUP` |
| `isolated-flow-evidence.json` | 隔离主链路 |
| `scheduler-verify.json` / `scheduler-verify.utf8.txt` | 调度鉴权 + worker |
| `run-summary.json` | 历史汇总 |

## 本地隔离数据库文件（仅本机 / GitHub 策略）

| 文件 | 是否进正式 ZIP | 说明 |
|------|----------------|------|
| `isolated-dedup.db` 等 `*.db` | **否** | 本地 SQLite 隔离库；结论以对应 **JSON** 为准 |
| GitHub | 若仓库中未跟踪 `.db`，属预期；勿把密码库打进包 |

## 历史过程证据（可选查阅）

| 文件 | 说明 |
|------|------|
| `r2-01-vitest.*` | Vitest 36（前收盘专项前） |
| `r2-02`…`r2-06` | 当时 typecheck/lint/build/dedup/flow |
| `01-vitest.log` 等早期日志 | 开发期 |

## 交叉引用

- `submission/02_测试说明与结果.md`  
- `submission/03_关键数字与结论追溯.md`  
- `submission/提交清单.md`
