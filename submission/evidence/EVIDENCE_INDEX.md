# 证据索引（UTF-8）

> 最终整理：2026-10-24  
> 业务代码基准：`233d09d715deb06c5a2ec70b7141f107a741ea16`  
> 旧证据**保留不覆盖**；本轮新增以 `r3-` 为前缀。

## 编码与安全

- `*.utf8.txt`、`*.json`、本索引为 **UTF-8**。  
- 未包含 API Key、数据库密码、`SCHEDULER_SECRET` 或连接串。  
- 公网 JSON 为公开接口响应；统计数字为**快照**，须标注时间。

## 本轮（r3）文件

| 文件 | 说明 |
|------|------|
| `r3-01-vitest.log` / `.utf8.txt` | Vitest：**45 passed / 0 failed** |
| `r3-02-typecheck.*` | `tsc --noEmit` 通过 |
| `r3-03-lint.*` | ESLint 通过 |
| `r3-04-build.*` | `next build` 通过 |
| `r3-05-public-health.json` | 公网 `/api/health` 快照 |
| `r3-06-public-stats.json` | 公网 `/api/stats` 完整快照 |
| `r3-06-public-stats.summary.json` | 脱敏摘要（计数 + DEDUP 样本字段） |
| `r3-run-summary.json` | 本轮汇总指针 |

## 历史（r2 / 早期，保留）

| 文件 | 说明 |
|------|------|
| `r2-01-vitest.*` | Vitest **36** passed（前收盘专项前） |
| `r2-02`…`r2-04` | 当时 typecheck / lint / build |
| `r2-05-dedup.*` + `dedup-evidence.json` | 独立去重 DEDUP |
| `r2-06-isolated-flow.*` + `isolated-flow-evidence.json` | 隔离主链路 |
| `scheduler-verify.json` | 调度鉴权 + worker |
| `isolated-*.db` | 隔离库文件 |
| `01-vitest.log` 等 | 更早开发期日志 |

## 交叉引用

- 测试说明：`submission/02_测试说明与结果.md`  
- 数字追溯：`submission/03_关键数字与结论追溯.md`  
- 提交清单：`submission/提交清单.md`
