# 拆分前端超大模块

## Goal

拆分 App、Workbench、SettingsDialog 与 model，保持行为和跨层契约

## Confirmed Facts

- 当前基线为 `App.tsx` 1386 行、`Workbench.tsx` 1477 行、`SettingsDialog.tsx` 1298 行、`model.ts` 1898 行，均超过项目 600 行文件上限。
- 现有 `src/components/` 已有 `DiagnosticsSection`、`ConfigProfileSection`、`ReportFormatSettings`、`RepositoryPanel`、`ReportHistory` 相关面板和多个 hooks，可作为拆分后的边界，不需要引入新的状态库。
- `model.ts` 被 App、Workbench、Settings、对话框、hooks、配置文件和报告历史共同引用；直接改写 import 路径会扩大回归面，因此保留兼容导出入口是必要的。
- 行为保护已存在于 `tests/e2e/workbench.spec.ts`、`settings-migration.spec.ts`、`report-history-storage.spec.ts`、`config-profile.spec.ts`、`accessibility.spec.ts`、`responsive-hardening.spec.ts` 和 `support-bundle.spec.ts`。

## Requirements

- R1：按业务边界拆分 `App.tsx`、`Workbench.tsx`、`SettingsDialog.tsx` 与 `model.ts`。
- R2：保持所有用户行为、持久化键、Tauri payload 和可访问性语义兼容。
- R3：共享状态通过专用 hooks/services 管理，组件不直接承担 Git/文件系统职责。
- R4：拆分分批进行，每批由现有 E2E 与新增定向测试保护。
- R5：拆分只移动职责和收窄依赖，不改变 Tauri 命令名、IPC camelCase 字段、localStorage key、错误文案或用户可见文本。
- R6：每一批完成后必须可独立回滚；不得把 App、Workbench、SettingsDialog 和 model 的移动混入一个无法定位的批量改动。

## Acceptance Criteria

- [x] AC1：上述目标文件均不超过 600 行，新增文件职责单一且无循环依赖。
- [x] AC2：全量 TypeScript build、E2E、a11y、responsive 与 Tauri smoke 通过。exact-SHA `c6a74ee2423eee31b2d00488d93cdaa479de74e9` 已通过 GitHub Actions run `29679387865`，包括 Linux/Windows Rust fmt/check/test、全量 Playwright、frontend build 与 Windows WebView smoke。
- [x] AC3：IPC payload、localStorage key、报告历史和设置迁移行为无回归。

## Technical Notes

- `src/model.ts` 在迁移期间继续作为稳定 barrel，旧 import 无需同步修改；新模块只能从更底层的 types/contracts 导入，禁止环形依赖。
- React 组件继续使用显式 Props，应用状态仍由 App 或专用 hook 持有；子组件只接收值和用户意图回调，不直接调用 Git、文件系统或 secure store。
- 拆分顺序固定为：模型 barrel -> Workbench 展示边界 -> Settings tab 边界 -> App 控制器/副作用边界。任何一批发现共享 contract 需要变化时，先停在该批并补测试。

## Out Of Scope

- 不改变产品功能、视觉语言、路由、状态管理库、Tauri command contract 或持久化 schema。
- 不在本任务中拆分 Rust 模块；Rust 拆分由后续 `07-18-rust-module-decomposition` 独立完成。
- 不借机清理无关 dead code、重命名用户可见文案或升级依赖。

## Dependency

- 依赖诊断支持任务完成，避免功能开发与大规模前端移动交叉。
