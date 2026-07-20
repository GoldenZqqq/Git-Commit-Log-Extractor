# 推进 v0.6 主线稳定化路线

## Goal

把 GitPulse 从快速功能扩张阶段推进到可持续交付阶段：先让已发布的 v0.5.3 回到 `main`，再建立发布、升级、性能、支持、架构和产品验证闭环。

## Requirements

- R1：子任务必须按依赖顺序串行推进，前置任务未完成时不得开始依赖任务。
- R2：每个子任务独立完成规划、实现、验证、归档、commit 和 push，不把多个任务混入同一交付批次。
- R3：任何产品行为变更必须保持 local-first、凭据安全和现有报告可追溯契约。
- R4：架构治理必须保持外部行为和 Tauri IPC 兼容，先有回归保护再拆分。
- R5：下一条产品功能主线必须由显式证据和决策记录选定，不以继续堆功能作为默认答案。

## Task Order

1. `07-18-mainline-v053-reconciliation`
2. `07-18-release-governance-docs`
3. `07-18-upgrade-migration-hardening`
4. `07-18-large-workspace-benchmark`
5. `07-18-privacy-safe-support-bundle`
6. `07-18-frontend-module-decomposition`
7. `07-18-rust-module-decomposition`
8. `07-18-product-validation-next-track`

## Acceptance Criteria

- [x] AC1：8 个子任务全部归档为 `completed`，父任务进度为 8/8。
- [x] AC2：每个子任务均有独立的验证证据、提交记录和远端 push 证据。
- [x] AC3：`main` 包含 v0.5.3 已发布能力，发布只能从受控主线执行。
- [x] AC4：升级、规模、支持与桌面质量门禁覆盖关键失败路径。
- [x] AC5：前端与 Rust 超大模块完成边界拆分，范围内核心源码文件满足项目 600 行上限；其他超限模块仍按子任务明确的非目标单独治理。
- [x] AC6：下一产品主线有证据、范围、非目标和进入实现的明确门槛；当前结论为继续验证。
- [x] AC7：最终全量构建、E2E、Rust 测试、Tauri smoke 和 `git diff --check` 通过，工作区与远端同步。

## Final Audit

完整的子任务提交/CI 映射、范围内行数、质量门禁和剩余风险见 `final-audit.md`；父审计修复提交 `1447ea2ccf0b983daa7d346730d59c8992f30b4a` 的 exact-SHA CI `29755711339` 已全绿。

## Out of Scope

- 不引入云端账户、默认遥测或服务端数据同步。
- 不在证据不足时同时启动多个新产品方向。
