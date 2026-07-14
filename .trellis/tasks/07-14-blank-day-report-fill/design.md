# 空白日补写 — 技术设计

## Architecture

独立于 **AI Polishing** 的「延续草稿」链路：

```
Workbench（日报 Tab）
  → BlankDayFillDialog
      → 扫描素材：复用 extract_commits / 区间提取（素材周期 + 勾选仓库）
      → 生成：新 command fill_blank_day_report（或同名 pipeline 函数）
          → ai::fill_blank_day_report（独立 system/user prompt）
      → 前端：可编辑要点 → 历史入库 → 可选应用到预览
```

原则：
- **不修改** `enhance_daily_report` / `daily_system_prompt` 的「禁止虚构」语义。
- 补写使用 `blank_day_system_prompt` + 专用 user prompt。
- 本地 Git 扫描仍在 Rust；前端只做配置与展示。

## UI Boundaries

| 区域 | 文件（预期） | 职责 |
|------|----------------|------|
| 入口 + 气泡 | `src/components/Workbench.tsx` + 样式 | 日报模式显示按钮；气泡默认展开/关闭持久化 |
| 弹窗 | `src/components/BlankDayFillDialog.tsx`（新建） | 配置、Tag、Prompt、生成、结果、应用 |
| 编排 | `src/App.tsx` | open state、busy、AI 配置、历史写入、预览替换 |
| 模型/选项 | `src/model.ts` | 请求 options、历史标记、气泡偏好读写 |
| 命令注册 | `src-tauri/src/lib.rs` | 注册 `fill_blank_day_report` |
| 流水线 | `src-tauri/src/commit_pipeline.rs` | 同步封装：提材 + 调 AI |
| AI | `src-tauri/src/ai.rs` | blank day system/user prompt + 调用 |
| 契约 | `src-tauri/src/models.rs` | `BlankDayFillOptions` / `BlankDayFillResult` |

## Data Contracts

### BlankDayFillOptions（草案）

- `targetDate`: 目标日
- `sourceStartDate` / `sourceEndDate`: 素材周期
- `itemCount`: 3 | 5 | 8
- `author` / 仓库列表 / mappings：对齐现有 extract
- `selectedRepos`: 勾选的仓库路径（+ 可选 branch 展示名）
- `userPrompt`: 用户可见 prompt
- `ai` 配置：与现有 enhance 一致（provider / key / base / model / proxy）

### BlankDayFillResult（草案）

- `draftText`: 要点列表纯文本
- `warnings`: 字符串数组（无素材、模型降级等）
- `sourceCommitCount` / `sourceRepoCount`: 可观测性
- `itemCount`: 请求条数

### 历史标记

复用 `ReportHistoryEntry`，MVP 不新增必填字段以免破坏校验：

- `title`: `空白日补写 · {targetDate}`
- `mode`: `summary`（日报）
- `range`: 目标日单日 range（或素材周期写 periodLabel 区分）
- `periodLabel`: 含 `补写草稿` 字样，例如 `补写草稿 · 2026-07-14`
- `aiEnhanced`: `true`（走了 AI）
- `reportText`: 生成的要点文本
- `commitCount`: 素材 commit 数（非目标日真实提交数）

若后续需要强筛选，可再加可选字段 `source: "blank-day-fill"`（需同步 `isReportHistoryEntry` 兼容旧数据）。

### 气泡偏好

- key 建议：`blankDayFillTipDismissed`（boolean）写入现有 settings / localStorage 偏好层（与其它 UI 偏好一致）。

## Data Flow

1. 用户打开弹窗：目标日默认 = 当前 `dailyDate`；素材周期默认 = 目标日前 3 天 ~ 前 1 天；条数 5；默认 prompt。
2. 素材周期变化或打开时：对启用仓库跑区间提取（可复用前端已有 repos + invoke extract，或弹窗内专用轻量扫描）。
3. 过滤出有 commit 的仓库 → Tag 默认全选。
4. 若目标日在当前索引下**有** commit：显示轻提示（非阻断）。检测可基于单日 extract 或已有预览/缓存；允许近似（打开时异步查一次）。
5. 生成：把勾选仓库的提交摘要拼成 base evidence → Rust AI → `draftText`。
6. 成功：写入历史；弹窗进入结果态。
7. 应用到预览：空则 set；非空则 `window.confirm` 后 set。

## Prompt Strategy

**System（不可见）** 要点：
- 角色：日报延续草稿助手
- 仅基于提供的历史提交线索
- 输出恰好 N 条短要点，每行一条，可用 `- `
- 禁止上线/验收/百分比/无依据新模块
- 明确告知读者这是延续草稿语义（不必每条重复 disclaimer，由 UI 承担）

**User** = 默认/用户 prompt + 目标日 + 条数 + 历史提交摘要块。

## Compatibility

- AI 未配置：与润色一致，禁用生成并引导设置。
- 素材为空：不可生成，提示扩大周期或检查作者/仓库。
- 失败：错误文案可读，不改预览、不写历史。
- 与批量生成、周月报无交叉。

## Trade-offs

| 选择 | 取舍 |
|------|------|
| 新 command vs 复用 enhance_report | 新 command 更清晰，避免污染润色契约 |
| 历史不增字段 | MVP 快；筛选能力弱，靠 title/periodLabel |
| 目标日有提交检测 | 异步一次 extract，略增打开成本 |

## Rollback

- 功能开关级：移除入口按钮即可回退 UX。
- 后端命令未注册时前端不调用。
- 历史旧条目无新字段，向前兼容。
