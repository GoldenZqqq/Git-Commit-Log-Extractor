# 拆分 Rust 超大模块

## Goal

拆分 report 与 git_ops，保持命令 API、输出和性能行为

## Requirements

- R1：拆分 `report.rs` 和 `git_ops.rs` 的渲染、导出、命名、仓库发现、Git 调用与提交提取职责。
- R2：保持 Tauri command、CLI、serde、错误文案、报告文本和导出文件兼容。
- R3：不得降低扫描循环保护、取消、并发边界或 Windows 无控制台行为。
- R4：先补模块边界测试，再执行机械移动和可见性收紧。

## Acceptance Criteria

- [ ] AC1：`report.rs`、`git_ops.rs` 及新增核心模块均不超过 600 行，或经职责拆分后剩余纯测试文件单独隔离。
- [ ] AC2：Rust fmt/check/test、CLI smoke、前端 build/E2E 与真实 Tauri smoke 通过。
- [ ] AC3：关键报告 golden/snapshot 与 Git fixture 输出保持一致。

## Dependency

- 依赖前端拆分完成，避免同时重构 IPC 两端。
