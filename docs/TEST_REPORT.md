# 测试报告

本报告只记录**实际执行过**的命令与结果。未运行项不标记为通过。  
正式用例表与公网人工验收见 `submission/02_测试说明与结果.md`。

## 口径提醒

| 口径 | 本轮数字 |
|------|----------|
| Vitest 自动化 | **45 passed**（`r4-01`，2026-10-25 重跑，真 UTF-8） |
| 历史 Vitest（r2） | 36 passed（保留） |
| 文档业务用例 | **30 = 29 通过 + 1 部分通过（C-05）** |
| 公网人工验收 | 8 项（用户报告，非 Vitest） |

不得把上述数字简单相加。

## 1. 单元 / 逻辑测试（本轮 2026-10-25）

**命令：** `npm run test`  
**日志：** `submission/evidence/r4-01-vitest.utf8.txt`（权威）；`r3-01-vitest.utf8.txt` 为同次结果修复回填

```
Test Files  8 passed (8)
Tests  45 passed (45)
exitCode: 0
```

含 `quote-override`。去重：`dedup-evidence.json`；公网 DEDUP：`r3-06-public-stats.summary.json`。  
早期误标 UTF-8 的损坏字节：`*.CORRUPT-utf16le.legacy.bin`。

## 2. TypeScript

**命令：** `npm run typecheck`  
**日志：** `submission/evidence/r4-02-typecheck.utf8.txt`  
**结果：** 通过（退出码 0）

## 3. ESLint

**命令：** `npm run lint`  
**日志：** `submission/evidence/r4-03-lint.utf8.txt`  
**结果：** 通过（退出码 0）

## 4. 生产构建

**命令：** `npm run build`  
**日志：** `submission/evidence/r4-04-build.utf8.txt`  
**结果：** 通过（退出码 0）

## 5. 公网只读核实

| 接口 | 结果 | 证据 |
|------|------|------|
| `/api/health` | 200，`ok`/`db:up`/`SIMULATED` | `r3-05-public-health.json` |
| `/api/stats` | 200；可见 DEDUP；计数为瞬时快照 | `r3-06-public-stats*.json` |

## 6. 已知限制

- SIMULATED 非实盘；不构成投资建议  
- C-05 未做全站人工合规签收 → **部分通过**  
- 演示视频已录制为 MKV，随正式 ZIP 提供（不进 GitHub）  
- 免费实例休眠会影响调度连续性  
