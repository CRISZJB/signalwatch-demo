# 证据索引（UTF-8）

生成时间：2026-10-24T06:40:40Z（本轮修复后）

## 编码说明

- 所有 `*.utf8.txt`、`*.json`、本索引均为 **UTF-8 无 BOM**。
- 原始 `*.log` 与对应 `.utf8.txt` 内容一致；结论以退出码与 JSON 字段为准，未改写测试结果。
- 未包含任何 API Key / 密码。日志中可能含本机路径以便复现。

## 文件列表

| 文件 | 说明 |
|------|------|
| `r2-01-vitest.log` / `.utf8.txt` | Vitest：**36 passed** |
| `r2-02-typecheck.*` | `tsc --noEmit` 通过 |
| `r2-03-lint.*` | ESLint 通过 |
| `r2-04-build.*` | `next build` 通过 |
| `r2-05-dedup.*` + `dedup-evidence.json` | **独立去重**：第二次 `skipReason=DEDUP` |
| `r2-06-isolated-flow.*` + `isolated-flow-evidence.json` | 隔离主链路 |
| `scheduler-verify.json` / `.utf8.txt` | 调度鉴权 401/200 + worker --once |
| `isolated-dedup.db` | 去重隔离库 |
| `isolated-submission.db` | 主链路隔离库 |
| `isolated-scheduler.db` | 调度验证库 |
| `run-summary.json` | 本轮汇总 |

## 与文档交叉引用

- 测试说明：`submission/02_测试说明与结果.md`
- 数字追溯：`submission/03_关键数字与结论追溯.md`
