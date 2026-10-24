# AI 使用与验证记录（简版）

正式、可交卷版本以 **`submission/01_AI使用与验证记录.md`** 为准。若冲突，以 submission 为准。

## 分工摘要

| 工具 | 工作 | 不可核实项 |
|------|------|------------|
| ChatGPT | 题目分析、提示词与方案讨论 | 具体模型名、调用次数 |
| Cursor Agent | 编码、测试、部署配置、提交材料 | 具体模型 slug、精确工时 |

运行时**不调用**外部 LLM。NL 解析为 `src/lib/nl-parser.ts` 确定性规则。

## 验证方式

- 本地：`npm run test`（本轮 45）/ `typecheck` / `lint` / `build` → `submission/evidence/r4-*`（真 UTF-8）
- 公网只读：`/api/health`、`/api/stats` → `r3-05` / `r3-06`
- 公网人工操作：用户 2026-10-24 验收（见 `submission/02`）

## 边界

- SIMULATED 数据；非投资建议；非券商交易系统
- 免费 Render 可能休眠；休眠时调度中断
- C-05 全面合规文案审查仍为部分通过
