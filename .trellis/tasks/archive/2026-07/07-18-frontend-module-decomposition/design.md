# 前端超大模块拆分设计

## Architecture And Boundaries

### 1. 稳定导出入口

- 保留 `src/model.ts` 作为兼容 barrel，只包含 `export type`、`export {}` 和少量向后兼容别名。
- 新增 `src/model/` 下的领域模块：
  - `types.ts`：IPC、报告、仓库、设置和历史共享类型；不依赖 React。
  - `settings.ts`：默认设置、localStorage 读写、迁移、secure-key 引用规范化。
  - `repository.ts`：仓库缓存、路径集合、映射解析和映射建议。
  - `report-options.ts`：作者别名、证据/脱敏规则、报告和 AI 选项 builder、校验。
  - `history.ts`：报告历史结构校验、排序、过滤、日历锚点和历史变更 helper。
  - `dates.ts`：日期、周、月份输入解析和范围计算。
  - `support-bundle.ts`：支持包 IPC 类型与 options builder。
- 依赖方向为 `types -> dates/settings/repository/history/report-options -> barrel`；领域模块不得反向导入 `model.ts`。

### 2. Workbench

- `Workbench.tsx` 保留页面级状态协调、任务策略和三视图路由，目标控制在 500 行以内。
- 新增 `WorkbenchHeader.tsx`、`ReportCanvas.tsx`、`WorkbenchAssistRail.tsx`、`WorkbenchEventLog.tsx`。
- 将现有 `ReportHistoryPanel` 及其筛选 helper 移入 `ReportHistoryPanel.tsx`，保留当前 props 和键盘行为。
- 将 `ReportPeriodControl`、`GenerationScopeStrip`、`PanelTitle` 移入 `WorkbenchControls.tsx`，只传递已计算的范围和回调。
- `Workbench` 继续拥有 `isPreviewExpanded`、popover refs、视图状态和 task blocking；子组件不复制冲突矩阵。

### 3. SettingsDialog

- `SettingsDialog.tsx` 保留 modal shell、tab selection、跨 tab settings callback 和 diagnostics hook，目标控制在 450 行以内。
- 新增 `SettingsTabNav.tsx`、`WorkspaceSettingsTab.tsx`、`AiSettingsTab.tsx`、`MappingSettingsTab.tsx`、`GeneralSettingsTab.tsx`、`DiagnosticsSettingsTab.tsx`。
- 已存在的 `ConfigProfileSection`、`ReportFormatSettings`、`DiagnosticsSection`、`SupportBundleSection` 作为子模块，不重新实现业务逻辑。
- AI polling、proxy testing、mapping confirmation 等副作用仍由 Settings controller 或专用 hook 持有，tab 组件只接收状态和 intent callbacks。
- 所有 dialog 继续使用 `useModalDialog` / `usePopover`，不在新 tab 中添加 document listener。

### 4. App

- `App.tsx` 最终保留根布局、Tauri listener 注册、task orchestration、Settings/Workbench/Batch/Blank-day dialog 组装，目标控制在 600 行以内。
- 新增 `useAppSettingsState`、`useReportGeneration`、`useReportExport`、`useSecureSettingsSync`；每个 hook 只拥有一个外部副作用边界。
- 第一阶段只提取无行为变化的 Props/type 和纯 helper；随后按生成、历史、secure settings 顺序提取异步操作。
- `showMessage`、`setStatus` 和 `runTask` 的事件/任务语义保持单一来源，避免拆分后重复写入 support event 或同时结束同一 task。

## Cross-Layer Contracts

- 所有旧的 `from "./model"` 和 `from "../model"` import 在整个迁移期间继续可用。
- Rust IPC payload 仍由现有 `src/model.ts` 导出类型和 builder 生成，字段名、可选性与空值策略不变。
- `STORAGE_KEY`、`REPORT_HISTORY_KEY`、迁移 backup key、repo cache key 及 secure-store command 名称不变。
- `useModalDialog`、`usePopover`、task activity conflict matrix 和 support event ring 不迁移所有权，只改变文件位置。

## Compatibility And Rollback

- 每一批只允许新增文件、移动代码和必要 import；若测试失败，回滚该批即可恢复上一批可运行状态。
- 不使用大范围自动格式化，避免无关 diff 淹没行为变更；移动后使用 `git diff --no-renames` 审查真实内容。
- 如果某个模块仍超过 600 行，继续沿同一边界拆分，不通过禁用 lint、压缩代码或豁免文件上限解决。
- 任何需要改 IPC/shared type 的发现都回退到 planning，补充 contract 测试后再继续。

## Verification Surface

- 模型批次：`npm run build`、配置 profile、settings migration、report history 和 model 定向测试。
- Workbench 批次：workbench、repository panel、workspace health、task-state、project retrospective、responsive。
- Settings 批次：settings migration、config profile、diagnostics、support bundle、a11y。
- App controller 批次：全量 `npm run test:e2e`、`npm run build`、Rust command compatibility、真实 Tauri smoke。
