# 拆分前端超大模块

## Goal

拆分 App、Workbench、SettingsDialog 与 model，保持行为和跨层契约

## Requirements

- R1：按业务边界拆分 `App.tsx`、`Workbench.tsx`、`SettingsDialog.tsx` 与 `model.ts`。
- R2：保持所有用户行为、持久化键、Tauri payload 和可访问性语义兼容。
- R3：共享状态通过专用 hooks/services 管理，组件不直接承担 Git/文件系统职责。
- R4：拆分分批进行，每批由现有 E2E 与新增定向测试保护。

## Acceptance Criteria

- [ ] AC1：上述目标文件均不超过 600 行，新增文件职责单一且无循环依赖。
- [ ] AC2：全量 TypeScript build、E2E、a11y、responsive 与 Tauri smoke 通过。
- [ ] AC3：IPC payload、localStorage key、报告历史和设置迁移行为无回归。

## Dependency

- 依赖诊断支持任务完成，避免功能开发与大规模前端移动交叉。
